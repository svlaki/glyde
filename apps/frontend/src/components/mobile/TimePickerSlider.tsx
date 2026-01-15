import { useEffect, useRef, useState, useCallback } from 'react'
import { useKeenSlider, KeenSliderPlugin } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'

// Wheel control plugin for mouse/trackpad scrolling
const WheelControls: KeenSliderPlugin = (slider) => {
  let touchTimeout: ReturnType<typeof setTimeout>
  let position: { x: number; y: number }
  let wheelActive: boolean

  function dispatch(e: WheelEvent, name: string) {
    // Smoother wheel sensitivity - reduce the delta for more controlled scrolling
    const sensitivity = 2
    position.y -= e.deltaY * sensitivity
    slider.container.dispatchEvent(
      new CustomEvent(name, {
        detail: {
          x: position.x,
          y: position.y,
        },
      })
    )
  }

  function wheelStart(e: WheelEvent) {
    position = { x: e.pageX, y: e.pageY }
    dispatch(e, 'ksDragStart')
  }

  function wheel(e: WheelEvent) {
    dispatch(e, 'ksDrag')
  }

  function wheelEnd(e: WheelEvent) {
    dispatch(e, 'ksDragEnd')
  }

  function eventWheel(e: WheelEvent) {
    e.preventDefault()
    if (!wheelActive) {
      wheelStart(e)
      wheelActive = true
    }
    wheel(e)
    clearTimeout(touchTimeout)
    // Longer timeout for smoother wheel end detection
    touchTimeout = setTimeout(() => {
      wheelActive = false
      wheelEnd(e)
    }, 80)
  }

  slider.on('created', () => {
    slider.container.addEventListener('wheel', eventWheel, { passive: false })
  })
}

interface SliderColumnProps {
  values: string[]
  value: string
  onChange: (value: string) => void
  loop?: boolean
  height: number
  itemHeight: number
  textColor: string
  selectedTextColor: string
  backgroundColor: string
}

function SliderColumn({
  values,
  value,
  onChange,
  loop = true,
  height,
  itemHeight,
  textColor,
  selectedTextColor,
  backgroundColor
}: SliderColumnProps) {
  const slidesPerView = Math.floor(height / itemHeight)
  const centerOffset = Math.floor(slidesPerView / 2)

  const initialSlide = values.indexOf(value)
  const [currentSlide, setCurrentSlide] = useState(initialSlide >= 0 ? initialSlide : 0)
  const isUpdatingRef = useRef(false)

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>(
    {
      vertical: true,
      loop: true,
      initial: initialSlide >= 0 ? initialSlide : 0,
      mode: 'free',
      slides: {
        perView: slidesPerView,
        origin: 'center',
        spacing: 0,
      },
      rubberband: false,
      dragSpeed: 3,
      defaultAnimation: {
        duration: 400,
        easing: (t: number) => 1 - Math.pow(1 - t, 4), // easeOutQuart for smooth deceleration
      },
      slideChanged: (slider) => {
        const idx = slider.track.details.rel
        setCurrentSlide(idx)
        if (!isUpdatingRef.current) {
          const newValue = values[idx]
          if (newValue !== undefined) {
            onChange(newValue)
          }
        }
      },
    },
    [WheelControls]
  )

  // Sync slider position when value changes externally
  useEffect(() => {
    const targetIdx = values.indexOf(value)
    if (targetIdx >= 0 && instanceRef.current && targetIdx !== currentSlide) {
      isUpdatingRef.current = true
      instanceRef.current.moveToIdx(targetIdx)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 100)
    }
  }, [value, values, currentSlide])

  return (
    <div
      style={{
        height: `${height}px`,
        position: 'relative',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Selection highlight */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: `${itemHeight}px`,
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Gradient overlays for fade effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${centerOffset * itemHeight}px`,
          background: `linear-gradient(to bottom, ${backgroundColor}, transparent)`,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${centerOffset * itemHeight}px`,
          background: `linear-gradient(to top, ${backgroundColor}, transparent)`,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      <div
        ref={sliderRef}
        className="keen-slider"
        style={{
          height: '100%',
        }}
      >
        {values.map((val, idx) => {
          const isSelected = idx === currentSlide
          return (
            <div
              key={idx}
              className="keen-slider__slide"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: `${itemHeight}px`,
                minHeight: `${itemHeight}px`,
                maxHeight: `${itemHeight}px`,
                fontSize: isSelected ? '20px' : '16px',
                fontWeight: isSelected ? '600' : '400',
                color: isSelected ? selectedTextColor : textColor,
                transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                opacity: isSelected ? 1 : 0.4,
                cursor: 'pointer',
              }}
              onClick={() => {
                if (instanceRef.current) {
                  instanceRef.current.moveToIdx(idx)
                }
              }}
            >
              {val}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TimePickerSliderProps {
  value: { hour: string; minute: string; period: string }
  onChange: (value: { hour: string; minute: string; period: string }) => void
  height?: number
  itemHeight?: number
  textColor?: string
  selectedTextColor?: string
  backgroundColor?: string
  borderColor?: string
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const PERIODS = ['AM', 'PM']

export function TimePickerSlider({
  value,
  onChange,
  height = 150,
  itemHeight = 36,
  textColor = '#999',
  selectedTextColor = '#000',
  backgroundColor = '#fff',
  borderColor = '#e5e5e5',
}: TimePickerSliderProps) {
  const handleHourChange = useCallback((hour: string) => {
    onChange({ ...value, hour })
  }, [value, onChange])

  const handleMinuteChange = useCallback((minute: string) => {
    onChange({ ...value, minute })
  }, [value, onChange])

  const handlePeriodChange = useCallback((period: string) => {
    onChange({ ...value, period })
  }, [value, onChange])

  return (
    <div
      style={{
        display: 'flex',
        background: backgroundColor,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Center selection bar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '8px',
          right: '8px',
          height: `${itemHeight}px`,
          transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,0.05)',
          borderRadius: '6px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <SliderColumn
        values={HOURS}
        value={value.hour}
        onChange={handleHourChange}
        loop={true}
        height={height}
        itemHeight={itemHeight}
        textColor={textColor}
        selectedTextColor={selectedTextColor}
        backgroundColor={backgroundColor}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '600',
          color: selectedTextColor,
          width: '16px',
        }}
      >
        :
      </div>

      <SliderColumn
        values={MINUTES}
        value={value.minute}
        onChange={handleMinuteChange}
        loop={true}
        height={height}
        itemHeight={itemHeight}
        textColor={textColor}
        selectedTextColor={selectedTextColor}
        backgroundColor={backgroundColor}
      />

      <SliderColumn
        values={PERIODS}
        value={value.period}
        onChange={handlePeriodChange}
        loop={false}
        height={height}
        itemHeight={itemHeight}
        textColor={textColor}
        selectedTextColor={selectedTextColor}
        backgroundColor={backgroundColor}
      />
    </div>
  )
}
