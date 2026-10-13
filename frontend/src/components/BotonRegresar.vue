<template>
  <button type="button" class="btn-back" @click="regresar">
    &larr; {{ label }}
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  label: {
    type: String,
    default: 'REGRESAR'
  },
  fallback: {
    type: String,
    default: '/inicio'
  }
})

const router = useRouter()

function regresar() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  router.push(props.fallback)
}
</script>
