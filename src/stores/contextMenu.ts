import { defineStore } from "pinia";
import { ref } from "vue";
import { useMainStore } from "../store";
import { Trigger } from "../types";
import { globalEventBus } from "../event_bus";

interface Action {
    label: string
    fn: () => void
    disabled?: () => boolean
}

interface ActionColumnHeader {
    type: "column_header", name: string
}
interface ActionCell {
    type: "cell", value?: string, columnId: string, error?: string, rowId: string
}
interface ActionTrigger {
    type: "trigger", trigger: Trigger
}

type ActionTypes = ActionColumnHeader | ActionCell | ActionTrigger


export const useContextMenuStore = defineStore("context_menu", () => {

    const show = (e: MouseEvent, type: ActionTypes) => {
        e.preventDefault();
        x.value = e.clientX + 1;
        y.value = e.clientY + 1;

        let layout = useMainStore().layout
        switch (type.type) {
            case "cell":
                const column = layout.getColumn(type.columnId)
                if (column?.faceted && !type.error) {
                    let ff = useMainStore().facets[column.name].items.find(i => i.label == type.value)
                    let label = "Filter by facet"
                    if (ff?.selected) {
                        label = "Unfilter by facet"
                    }
                    actions.value?.push({
                        label,
                        fn: () => {
                            if (ff) {
                                ff.selected = !ff.selected
                            }
                            hide()
                        }
                    })
                }
                if (layout.settings.correlationIdField === column.name && type.value) {
                    actions.value?.push({
                        label: "Display correlated lines",
                        fn: () => {
                            useMainStore().filterCorrelatedId(type.value!)
                            hide()
                        }
                    })
                }
                actions.value?.push({
                    label: "Show in context",
                    fn: () => {
                        useMainStore().showInContext(type.rowId)
                        hide()
                    }
                })
                /**
                 * The feature of filtering by value is currently disabled due to the fact that 
                 * we're unable to effectively trace the source field only by using name.
                 * It requires a bigger change in functionality where we select a field to display in the column
                 * by allowing to provide it as a string path ie. `field.foo.bar` would correspond to {field:{foo:{bar:"baz"}}}
                 * In addition it should be taken into account when the object is flatten to {"field.foo.bar": "baz"}
                 */
                // actions.value?.push({
                //     label: "Search by value",
                //     fn: () => {
                //         let v = type.value
                //         switch (typeof v) {
                //             case "string":
                //                 v = `"${v}"`
                //                 break
                //             case "number":
                //             case "boolean":
                //                 v = `${v}`
                //                 break
                //         }
                //         globalEventBus.emit('searchbar-update', `data.${column.name} == ${v}`)
                //         hide()
                //     }
                // })
                actions.value?.push({
                    label: "Copy value",
                    fn: () => {
                        let v = type.value || type.error
                        if (v) {
                            navigator.clipboard.writeText(v)
                        }
                        hide()
                    }
                })
                actions.value?.push({
                    label: "Copy column name",
                    fn: () => {
                        navigator.clipboard.writeText(column.name)
                        hide()
                    }
                })
                break
            case "column_header":
                actions.value?.push({
                    label: "Copy column name",
                    fn: () => {
                        navigator.clipboard.writeText(type.name)
                        hide()
                    }
                })
                actions.value?.push({
                    label: "Clear facet values",
                    fn: () => {
                        useMainStore().clearFacet(type.name)
                        hide()
                    },
                    disabled: () => !useMainStore().isFacetActive(type.name)
                })
                break
            case "trigger":
                const t = type.trigger
                actions.value?.push({
                    label: t.enabled ? "Stop trigger" : "Start trigger",
                    fn: () => {
                        t.enabled = !t.enabled
                        hide()
                    }
                })
                actions.value?.push({
                    label: "Show triggers (Search)",
                    fn: () => {
                        globalEventBus.emit('searchbar-update', t.pattern)
                        hide()
                    }
                })
                actions.value?.push({
                    label: t.sound ? "Stop sound" : "Start sound",
                    fn: () => {
                        t.sound = !t.sound
                        hide()
                    }
                })
                actions.value?.push({
                    label: t.alert ? "Stop alert msg" : "Start alert msg",
                    fn: () => {
                        t.alert = !t.alert
                        hide()
                    }
                })
                actions.value?.push({
                    label: "Reset count",
                    fn: () => {
                        t.matchCount = 0
                        hide()
                    }
                })
                actions.value?.push({
                    label: "Remove trigger",
                    fn: () => {
                        useMainStore().removeTrigger(t.id)
                        hide()
                    }
                })
                break
        }

        display.value = true
    }

    const hide = () => {
        display.value = false
        actions.value = []
    }

    const display = ref<Boolean>(false)

    const x = ref<Number>()
    const y = ref<Number>()

    const actions = ref<Action[]>([])


    return {
        show,
        hide,
        x,
        y,
        display,
        actions
    };
});