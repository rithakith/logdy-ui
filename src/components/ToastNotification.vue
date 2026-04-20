<script setup lang="ts">
import { useMainStore } from "../store";
const store = useMainStore();
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in store.toasts" 
        :key="toast.id" 
        class="toast" 
        :class="toast.type"
        @click="store.removeToast(toast.id)"
      >
        <div class="toast-content">
          {{ toast.msg }}
          <span v-if="toast.count > 1" class="toast-count">({{ toast.count }})</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  min-width: 200px;
  max-width: 350px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: var(--hl-bg3);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  border-left: 4px solid var(--info);
  font-size: 14px;
  
  &.success { border-left-color: #48bb78; }
  &.error { border-left-color: #f56565; }
  &.warning { border-left-color: #ed8936; }
  &.info { border-left-color: var(--info); }

  .toast-count {
    font-weight: 800;
    margin-left: 6px;
    opacity: 0.8;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
