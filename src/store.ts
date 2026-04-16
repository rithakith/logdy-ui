import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { storageApp, storageLogs } from "./storage";
import { FacetValues, Message, Row, TraceRow } from "./types";
import { Layout } from "./config";
import { useFilterStore } from "./stores/filter";
import { client } from "./api";
import { formatThousands, getUrlParam } from "./utils";
import { SortPropName } from "./components/Facet.vue";
import { BreserFilterData, BreserSetQuery } from "./breser";
import moment from "moment";
import { globalEventBus } from "./event_bus";

export interface Notification {
    id?: string;
    timeout?: number;
    msg: string;
    type?: "info" | "error" | "warning" | "success"
}

export interface InitSettings {
    received: boolean;
    analyticsEnabled: boolean;
    authRequired: boolean;
    apiPrefix: string;

    // this will hold a Layout JSON to load from the backend
    configStr: string;

    updateVersion: UpdateResponse
}

export interface UpdateResponse {
    checked: boolean;
    local_version: string;
    current_version: string;
    current_version_published: string;
    download_link: string;
    blog_link: string;
    excerpt: string;
}

type ReceiveStatus = "paused" | "following" | "following_cursor"

interface ReceiveCounters {
    MessageCount: number,
    MessagesToTail: number,
    LastDeliveredIdx: number
}

export const useMainStore = defineStore("main", () => {

    const demoMode = ref<boolean>(
        document.location.host.indexOf('demo.logdy.dev') >= 0 ||
        !!getUrlParam(document.location.search, 'demo_mode')
    )
    const demoStatus = ref<"started" | "stopped">("started")
    const demoContent = ref<"json" | "string">("json")

    const breserQuery = ref<string>("")
    const breserQueryError = ref<string>("")
    const datepicker = ref<{ from: number, to: number }>({ from: 0, to: 0 })

    const confirmMsg = ref<string>("");
    const confirmShow = ref<boolean>(false);

    const status = ref<"connected" | "not connected">("not connected")
    const receiveStatus = ref<ReceiveStatus>(demoMode.value ? "following" : "paused")
    const receiveCounters = ref<ReceiveCounters>({ LastDeliveredIdx: 0, MessageCount: 0, MessagesToTail: 0 })
    const anotherTab = ref<boolean>(false)
    const modalShow = ref<"" | "auth" | "import" | "export-logs" | "load-logs" | "feedback">("")
    const password = ref<string>("")
    const stickedToBottom = ref<boolean>(false)
    const rows = ref<Row[]>([])
    const rowsIds = ref<Record<string, boolean>>({})
    const facets = ref<FacetValues>({})
    const searchbar = ref<string>("")
    const highlights = ref<{ id: string, text: string, color: string }[]>(
        storageApp.getOne("main")?.highlights || [
            { id: Math.random().toString(36).substr(2, 9), text: "", color: "#ffff00" }
        ]
    )

    watch(highlights, () => {
        storageApp.upsert("main", { highlights: highlights.value })
    }, { deep: true })
    const settingsDrawer = ref<boolean>(false)
    const correlationFilter = ref<string>("")
    const highlightedRowId = ref<string>("")
    const tracesRows = ref<Record<string, TraceRow>>({})
    const facetSort = ref<SortPropName>("label")

    const initSettings = ref<InitSettings>()

    const drawer = ref<{
        row?: Row,
        idx?: number
    }>({})

    const layout = ref<Layout>(new Layout('main', { leftColWidth: 300, drawerColWidth: 900, maxMessages: 100000, middlewares: [], entriesOrder: 'desc', applicationName: '' }))

    let confirmFn: (() => void) | null = null;

    const setPassword = (pass: string, store: boolean = true) => {
        password.value = pass
        if (store) {
            storageApp.add({ password: pass }, "main")
        }
    }

    const getPassword = (): string => {
        if (!password.value) {
            password.value = storageApp.getOne("main")?.password || ""
        }
        return password.value
    }

    const confirm = (msg: string, fn: () => void) => {
        confirmMsg.value = msg
        confirmShow.value = true
        confirmFn = fn
    }

    const confirmProcess = async (confirm: boolean) => {
        if (confirm && confirmFn) {
            await confirmFn()
        }
        confirmFn = null
        confirmMsg.value = ""
        confirmShow.value = false
    }

    const datepickerLabel = computed(() => {
        if (datepicker.value.from <= 0 && datepicker.value.to <= 0) {
            return 'Set timeframe'
        }

        let from = moment(datepicker.value.from * 1000)
        let to = moment(datepicker.value.to * 1000)

        let start = from.format('MMM DD, HH:mmA')
        let until = from.format('MMM DD, HH:mmA')

        if (from.format('DD-MM-YYYY') === to.format('DD-MM-YYYY')) {
            start = from.format('MMM DD, HH:mmA')
            until = to.format('HH:mmA')
        }
        if (datepicker.value.to === 0) {
            until = 'now'
        }

        return `${start} - ${until}`
    })

    const openLogDrawer = (row: Row, delta: number = 0) => {
        closeLogDrawer()

        if (delta !== 0) {
            for (let i = 0; i <= displayRows.value.length; i++) {
                if (displayRows.value[i].id !== row.id) {
                    continue
                }
                row = displayRows.value[i + delta]
                break
            }
        }

        if (!row) {
            return
        }

        if (!row.opened) {
            useFilterStore().changeFilter('read', 1)
            useFilterStore().changeFilter('unread', -1)
        }

        row.open = true;
        row.opened = true;
        drawer.value.row = row;
        storageLogs.update(row.id, { id: row.id, message: row.msg, opened: true, starred: row.starred })
    }

    const closeLogDrawer = () => {
        if (!drawer.value.row) {
            return
        }
        drawer.value.row.open = false
        drawer.value.row.opened = true;
        drawer.value.row = undefined
    }

    const toggleRowMark = (row: Row) => {
        row.starred = !row.starred
        useFilterStore().changeFilter('starred', row.starred ? 1 : -1)
        storageLogs.update(row.id, { id: row.id, message: row.msg, opened: row.opened, starred: row.starred })
    }

    const channel = new BroadcastChannel('tab-activity');

    setInterval(() => {
        channel.postMessage("ping")
    }, 5 * 1000)

    channel.addEventListener('message', (event) => {
        if (event.data === 'ping') {
            channel.postMessage('pong')
        }

        if (!anotherTab.value) {
            confirm("We have detected Logdy opened in another tab. Currently we do not support multiple tabs", () => {
                anotherTab.value = false
            })
        }
        anotherTab.value = true
    });

    const statusStr = computed(() => {
        if (receiveStatus.value === 'paused') {
            return `Paused at entry #${formatThousands(receiveCounters.value.LastDeliveredIdx + 1)} out of ${formatThousands(receiveCounters.value.MessageCount)
                } (${formatThousands(receiveCounters.value.MessageCount - receiveCounters.value.LastDeliveredIdx - 1)} not seen)`
        }
        if (receiveStatus.value.includes('following')) {
            return `Following real-time out of ${formatThousands(receiveCounters?.value.MessageCount)} entries`
        }
        return '-'
    })

    const filterCorrelated = (row: Row | Message) => {
        const correlationId = 'msg' in row ? row.msg.correlation_id : row.correlation_id;
        if (!correlationId) {
            return
        }
        filterCorrelatedId(correlationId)
    }

    const filterCorrelatedId = (id: string) => {
        correlationFilter.value = id
        refeshFilterCorrelated()
    }

    const showInContext = (rowId: string) => {
        searchbar.value = ""
        globalEventBus.emit('searchbar-update', "")
        resetAllFiltersAndFacets()
        correlationFilter.value = ""
        highlightedRowId.value = rowId
        setTimeout(() => {
            globalEventBus.emit('scroll-to-row', rowId)
        }, 50)
    }

    const refeshFilterCorrelated = () => {
        if (!correlationFilter.value || displayRows.value.length === 0) {
            return
        }

        let idx = 0
        if (layout.value.settings.entriesOrder === 'desc') {
            idx = displayRows.value.length - 1
        }

        let traces: Record<string, TraceRow> = {}
        let absStart = displayRows.value[idx].msg.timing && displayRows.value[idx].msg.timing!.start || 0
        let resolution = 1//(end - absStart) / 1000
        displayRows.value.forEach((r) => {
            if (!r.msg.timing) {
                return
            }

            let duration = r.msg.timing.duration

            if (r.msg.timing.end) {
                duration = r.msg.timing.end - r.msg.timing.start
            }

            traces[r.id] = {
                id: r.id,
                offset: (r.msg.timing!.start - absStart) / resolution,
                width: (duration || 1) / resolution,
                label: r.msg.timing?.label,
                style: r.msg.timing?.style || {}
            }
        })

        tracesRows.value = traces
    }

    const resetAllFiltersAndFacets = () => {
        useFilterStore().resetToggles()
        clearAllFacets()
    }

    const resetCorrelationFilter = () => {
        correlationFilter.value = ""
        highlightedRowId.value = ""
    }

    const changeReceiveStatus = async (status: ReceiveStatus) => {
        switch (status) {
            case 'following':
                await client.resume()
                receiveStatus.value = 'following';
                if (demoMode.value) {
                    demoStatus.value = 'started'
                }
                break;
            case 'following_cursor':
                await client.resumeFromCursor()
                receiveStatus.value = 'following_cursor';
                if (demoMode.value) {
                    demoStatus.value = 'started'
                }
                break;
            case 'paused':
                await client.pause()
                receiveStatus.value = 'paused';
                if (demoMode.value) {
                    demoStatus.value = 'stopped'
                }
                break;
        }
    }

    const clearAllRows = () => {
        rows.value = []
        facets.value = {}
        rowsIds.value = {}
        useFilterStore().reset()
        storageLogs.removeAll()
    }

    const clearRowIds = () => {
        rowsIds.value = {}
    }

    const clearAllFacets = () => {
        for (let i in facets.value) {
            let f = facets.value[i]
            for (let i2 in f.items) {
                facets.value[f.name].items[i2].selected = false
            }
        }
    }

    const searchClear = () => {
        searchbar.value = ""
    }

    const addHighlight = () => {
        const colors = ["#ffff00", "#38bdf8", "#fbbf24", "#34d399", "#f87171", "#a78bfa"];
        const color = colors[highlights.value.length % colors.length];
        highlights.value.push({
            id: Math.random().toString(36).substr(2, 9),
            text: "",
            color
        });
    }

    const removeHighlight = (id: string) => {
        highlights.value = highlights.value.filter(h => h.id !== id);
        if (highlights.value.length === 0) {
            addHighlight();
        }
    }

    const hasActiveHighlights = computed(() => {
        return highlights.value.some(h => h.text.trim().length > 0)
    })

    const isRecordJson = computed(() => {
        return rows.value[0] && rows.value[0].msg.is_json == true
    })

    const searchbarValid = computed(() => {
        if (isRecordJson.value) {
            return breserQueryError.value
        } else {
            try {
                new RegExp(searchbar.value, 'i')
                return ''
            } catch (e) {
                return (e as any).message
            }
        }
    })

    const displayRows = computed(() => {

        if (searchbarValid.value.length > 0) {
            return []
        }

        const selectedFacets: Record<string, string[]> = {}
        for (let i in facets.value) {
            facets.value[i].items.forEach(el => {
                if (el.selected) {
                    if (!selectedFacets[i]) {
                        selectedFacets[i] = []
                    }
                    selectedFacets[i].push(el.label)
                }
            })
        }

        let filters = useFilterStore().enabledFilters
        let fileOriginFilter = filters.filter(f => f.startsWith('origin_file_')).length > 0
        let portOriginFilter = filters.filter(f => f.startsWith('origin_port_')).length > 0
        let naOriginFilter = filters.filter(f => f.startsWith('origin_na')).length > 0
        let originFilter = filters.filter(f => f.startsWith('origin_')).length > 0

        let response = rows.value.filter(m => {
            let unixMessageTime = m.msg.ts / 1000
            if (datepicker.value.from > 0 && unixMessageTime < datepicker.value.from) {
                return false
            }

            if (datepicker.value.to > 0 && unixMessageTime > datepicker.value.to) {
                return false
            }
            return true
        }).filter((r) => {

            if (correlationFilter.value && correlationFilter.value != r.msg.correlation_id) {
                return false;
            }

            let ret = true
            if (filters.length > 0) {
                if (filters.includes('starred') && !r.starred) return false
                if (filters.includes('read') && !r.opened) return false
                if (filters.includes('unread') && r.opened) return false

                if (originFilter) {
                    if (fileOriginFilter && r.msg.origin?.file && filters.includes('origin_file_' + r.msg.origin?.file)) {
                        ret = true
                    } else if (portOriginFilter && r.msg.origin?.port && filters.includes('origin_port_' + r.msg.origin?.port)) {
                        ret = true
                    } else if (naOriginFilter && (!r.msg.origin?.file && !r.msg.origin?.port) && filters.includes('origin_na')) {
                        ret = true
                    } else {
                        ret = false
                    }
                }
            }
            if (!ret) {
                return ret
            }

            if (Object.keys(selectedFacets).length === 0) return true
            let sel = { ...selectedFacets }
            let cnt = Object.keys(sel).length

            r.facets.forEach(f => {
                if (sel[f.name] && sel[f.name].includes(f.value)) {
                    cnt--
                }
            })
            return cnt === 0
        })

        let breserResults: boolean[] = []
        if (isRecordJson.value && breserQuery.value.length > 0 && breserQueryError.value.length === 0) {
            let res = BreserFilterData(response.map(m => {
                return {
                    data: m.msg.json_content,
                    raw: m.msg.content,
                    ts: m.msg.ts,
                    origin: m.msg.origin
                }
            }).filter(m => m))
            if (res && !res.error && res.result && res.result.length == response.length) {
                breserResults = res.result
            }
        }

        response = response.filter((r, i) => {
            if (searchbar.value.length < 1) {
                return true
            }

            // check string match
            const matchesString = (r.msg.content || "").search(new RegExp(searchbar.value, 'i')) >= 0
            if (matchesString) {
                return true
            }

            // check breser match
            if (breserResults.length > 0 && breserResults[i]) {
                return true
            }

            return false
        })

        if (layout.value.settings.entriesOrder === 'desc') {
            return response.reverse()
        } else {
            return response
        }
    })

    const getUpdate = () => {
        return initSettings.value?.updateVersion
    }

    const isFacetActive = (name: string) => {
        for (let f in facets.value) {
            if (facets.value[f].name !== name) {
                continue
            }
            return facets.value[f].items.find(f => f.selected == true) != undefined
        }
        return false
    }

    const clearFacet = (name: string) => {
        for (let f in facets.value) {
            if (facets.value[f].name !== name) {
                continue
            }
            facets.value[f].items.forEach(f => {
                f.selected = false
            })
        }
    }

    watch(searchbar, (newVal) => {
        if (!isRecordJson.value) {
            return
        }
        breserQueryError.value = ""

        if (!newVal.length) {
            breserQuery.value = ""
            return
        }

        let error = BreserSetQuery(newVal)
        if (error) {
            breserQueryError.value = error
            return
        }

        breserQuery.value = newVal
    })

    return {
        confirm,
        confirmShow,
        confirmMsg,
        confirmProcess,

        demoMode,
        demoStatus,
        demoContent,
        status,
        statusStr,

        getUpdate,

        receiveStatus,
        receiveCounters,
        changeReceiveStatus,

        initSettings,
        anotherTab,
        modalShow,

        setPassword,
        getPassword,

        stickedToBottom,

        clearAllRows,
        resetAllFiltersAndFacets,
        filterCorrelated,
        filterCorrelatedId,
        showInContext,
        correlationFilter,
        highlightedRowId,
        resetCorrelationFilter,
        tracesRows,
        refeshFilterCorrelated,

        settingsDrawer,

        drawer,
        openLogDrawer,
        closeLogDrawer,

        layout,

        rows,
        rowsIds,
        clearRowIds,
        displayRows,

        facets,
        isFacetActive,
        clearFacet,
        searchbar,
        searchbarValid,
        searchClear,
        highlights,
        hasActiveHighlights,
        addHighlight,
        removeHighlight,

        toggleRowMark,
        facetSort,

        datepicker,
        datepickerLabel
    };
});