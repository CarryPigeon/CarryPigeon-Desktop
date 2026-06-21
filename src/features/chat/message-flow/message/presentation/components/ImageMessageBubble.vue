<template>
  <div class="image-message-bubble">
    <!-- Container for Intersection Observer -->
    <div ref="imgRef" class="image-container">
      <!-- Loading skeleton -->
      <div v-if="loadState === 'pending' || loadState === 'loading'" class="image-skeleton">
        <div class="skeleton-content">
          <div class="skeleton-shimmer"></div>
        </div>
      </div>

      <!-- Image display -->
      <img
        v-else-if="loadState === 'loaded'"
        :src="imageSrc"
        :alt="props.fileName"
        class="message-image"
        :style="{ maxHeight: '300px', maxWidth: '100%', width: props.width ? `${props.width}px` : 'auto' }"
        @load="onImageLoad"
        @error="onImageError"
        @click="handleImageClick"
      />

      <!-- Error state with retry -->
      <div v-else-if="loadState === 'error'" class="image-error">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <p class="error-message">{{ t("image_load_failed") }}</p>
          <button v-if="retryCount < maxRetries" @click="retryLoad" class="retry-button">
            {{ t("image_retry") }} ({{ retryCount + 1 }}/{{ maxRetries }})
          </button>
          <p v-else class="error-message">{{ t("image_max_retries") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  url: string
  thumbUrl?: string
  fileName: string
  fileSize: number
  width?: number
  height?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'openLightbox', payload: any): void
}>()

const loadState = ref<'loading' | 'loaded' | 'error' | 'pending'>('pending')
const imgRef = ref<HTMLDivElement>()
const isLoadingError = ref(false)
const imgObject = ref<HTMLImageElement | null>(null)
const retryCount = ref(0)
const maxRetries = 3

// Use thumbUrl for preview if available, otherwise use original url
const imageSrc = ref(props.thumbUrl || props.url)

// Intersection Observer for lazy loading
let intersectionObserver: IntersectionObserver | null = null
let isIntersectionObserverActive = false

// Setup Intersection Observer for lazy loading
const setupIntersectionObserver = () => {
  if (!imgRef.value || isIntersectionObserverActive) {
    return
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && loadState.value === 'pending') {
          startLoadingImage()
        }
      })
    },
    {
      root: null, // viewport
      rootMargin: '100px', // start loading 100px before entering viewport
      threshold: 0.01 // trigger as soon as 1% is visible
    }
  )

  intersectionObserver.observe(imgRef.value)
  isIntersectionObserverActive = true
}

// Cleanup Intersection Observer
const cleanupIntersectionObserver = () => {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
    isIntersectionObserverActive = false
  }
}

// Start loading the image
const startLoadingImage = () => {
  if (loadState.value !== 'pending') {
    return
  }

  loadState.value = 'loading'

  // Create Image object to preload
  const img = new Image()
  imgObject.value = img

  img.onload = () => {
    loadState.value = 'loaded'
    isLoadingError.value = false
    // 确保 imageSrc 更新触发 <img> 渲染
    if (imgRef.value) {
      imageSrc.value = props.thumbUrl || props.url
    }
  }

  img.onerror = () => {
    loadState.value = 'error'
    isLoadingError.value = true
  }

  // Start loading
  img.src = props.thumbUrl || props.url
}

// Handle image load event
const onImageLoad = () => {
  loadState.value = 'loaded'
  isLoadingError.value = false
}

// Handle image error event
const onImageError = () => {
  loadState.value = 'error'
  isLoadingError.value = true
}

// Handle image click for lightbox
const handleImageClick = () => {
  emit('openLightbox', {
    url: props.url,
    fileName: props.fileName,
    fileSize: props.fileSize,
    width: props.width,
    height: props.height
  })
}

// Retry loading the image
const retryLoad = () => {
  if (retryCount.value >= maxRetries) {
    return
  }

  retryCount.value++
  loadState.value = 'pending'
  isLoadingError.value = false

  // Give a small delay before retry
  setTimeout(() => {
    startLoadingImage()
  }, 500 * retryCount.value)
}

// Watch for image URL changes
watch(
  () => props.url,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      loadState.value = 'pending'
      retryCount.value = 0
      isLoadingError.value = false
      imgObject.value = null
      imageSrc.value = props.thumbUrl || newUrl

      // Reset observer if it's active
      if (isIntersectionObserverActive) {
        cleanupIntersectionObserver()
        setTimeout(() => setupIntersectionObserver(), 0)
      }
    }
  }
)

onMounted(() => {
  // Setup Intersection Observer for lazy loading
  // Use nextTick to ensure imgRef is available
  setTimeout(() => {
    setupIntersectionObserver()
  }, 0)
})

onUnmounted(() => {
  cleanupIntersectionObserver()

  // Clean up image object
  if (imgObject.value) {
    imgObject.value.onload = null
    imgObject.value.onerror = null
    imgObject.value.src = ''
    imgObject.value = null
  }
})
</script>

<style scoped>
.image-message-bubble {
  display: inline-block;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.image-skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  position: relative;
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
  background-size: 50% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -50% 0;
  }
  100% {
    background-position: 150% 0;
  }
}

.message-image {
  display: block;
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  transition: opacity 0.3s ease;
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background-color: rgba(255, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.error-content {
  text-align: center;
  padding: 20px;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.error-message {
  color: rgba(255, 255, 255, 0.7);
  margin: 10px 0;
  font-size: 14px;
}

.retry-button {
  background-color: rgba(59, 130, 246, 0.8);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: rgba(59, 130, 246, 1);
}
</style>