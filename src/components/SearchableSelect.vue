<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ChevronDown, Search, X, Check } from 'lucide-vue-next';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder: string;
    searchPlaceholder?: string;
    emptyText?: string;
  }>(),
  {
    searchPlaceholder: 'Search...',
    emptyText: 'No matches',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isOpen = ref(false);
const filterText = ref('');
const rootRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const selectedOption = computed(() =>
  props.options.find((opt) => opt.value === props.modelValue)
);

const filteredOptions = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
  );
});

async function toggleOpen() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    filterText.value = '';
    await nextTick();
    searchInputRef.value?.focus();
  }
}

function selectOption(val: string) {
  emit('update:modelValue', val);
  isOpen.value = false;
  filterText.value = '';
}

function clearSelection(e: Event) {
  e.stopPropagation();
  emit('update:modelValue', '');
  filterText.value = '';
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div ref="rootRef" class="relative w-full sm:w-auto sm:min-w-[210px]">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
      @click="toggleOpen"
    >
      <span class="truncate text-left" :class="selectedOption ? 'text-slate-100 font-medium' : 'text-slate-400'">
        {{ selectedOption ? selectedOption.label : placeholder }}
      </span>
      <span class="flex items-center gap-1 shrink-0">
        <X
          v-if="modelValue"
          class="w-4 h-4 text-slate-400 hover:text-rose-400 transition"
          @click="clearSelection"
        />
        <ChevronDown
          class="w-4 h-4 text-slate-400 transition-transform duration-150"
          :class="{ 'rotate-180': isOpen }"
        />
      </span>
    </button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-1.5 w-full min-w-[260px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
    >
      <div class="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/60">
        <Search class="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref="searchInputRef"
          v-model="filterText"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      <ul class="max-h-64 overflow-y-auto py-1 divide-y divide-slate-800/40">
        <li>
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800/70 transition"
            :class="!modelValue ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-300'"
            @click="selectOption('')"
          >
            <span>{{ placeholder }}</span>
            <Check v-if="!modelValue" class="w-4 h-4 text-blue-400 shrink-0" />
          </button>
        </li>
        <li v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-xs text-slate-500">
          {{ emptyText }}
        </li>
        <li v-for="opt in filteredOptions" :key="opt.value">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800/70 transition"
            :class="modelValue === opt.value ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-200'"
            @click="selectOption(opt.value)"
          >
            <span class="truncate">{{ opt.label }}</span>
            <span class="flex items-center gap-1.5 shrink-0">
              <span v-if="opt.sublabel" class="text-xs font-mono text-slate-400">{{ opt.sublabel }}</span>
              <Check v-if="modelValue === opt.value" class="w-4 h-4 text-blue-400" />
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
