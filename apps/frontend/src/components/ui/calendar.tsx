import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  ...props
}: CalendarProps & { fixedWeeks?: boolean }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      className={cn("p-4 w-full min-w-[310px]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 relative",
        month_caption: "flex justify-center items-center h-15 mb-2",
        caption_label: "text-base font-semibold",
        nav: "absolute top-0 left-0 right-0 flex justify-between items-center h-10 z-10",
        button_previous:
          "h-12 w-12 hover:bg-red-600 text-white p-0 border-0 rounded-full flex items-center justify-center overflow-visible",
        button_next:
          "h-12 w-12 hover:bg-red-600 text-white p-0 border-0 rounded-full flex items-center justify-center overflow-visible",
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 mb-1",
        weekday:
          "text-muted-foreground font-medium text-sm text-center py-1.5",
        week: "grid grid-cols-7",
        day: "relative p-0.5 text-center text-base focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal text-base aria-selected:opacity-100 mx-auto"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        today: "bg-red-500 text-white rounded-full hover:bg-red-500 hover:text-white",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-7 w-7 text-black" />
          }
          return <ChevronRight className="h-7 w-7 text-black" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
