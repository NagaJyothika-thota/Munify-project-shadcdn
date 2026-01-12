import * as React from "react"
import { Calendar as CalendarIcon, ChevronDown as ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type DatePickerProps = {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  buttonClassName?: string
  popoverClassName?: string
  closeOnSelect?: boolean
  disableFutureDates?: boolean 
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  buttonClassName,
  popoverClassName,
  closeOnSelect = true,
  disableFutureDates = false,
}: DatePickerProps) {
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(value)
  const isControlled = typeof onChange === "function"
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isControlled) return
    setInternalDate(value)
  }, [value, isControlled])

  const handleSelect = React.useCallback(
    (next?: Date) => {
      if (isControlled) {
        onChange?.(next)
      } else {
        setInternalDate(next)
      }
      if (closeOnSelect && next) setOpen(false)
    },
    [isControlled, onChange]
  )

  const current = isControlled ? value : internalDate

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!current}
          className={cn(
            "w-48 justify-between font-normal data-[empty=true]:text-muted-foreground",
            buttonClassName
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {current ? current.toLocaleDateString() : placeholder}
            </span>
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", popoverClassName)}>
        <Calendar
          mode="single"
          selected={current}
          captionLayout="dropdown"
          // Allow navigating freely across a wide year range so the
          // calendar is not implicitly capped to the current month/year.
          fromYear={1900}
          toYear={2100}
          onSelect={handleSelect}
          initialFocus
          disabled={disableFutureDates ? (date) => date > new Date() : undefined}  // ⬅ Disable ALL future dates
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePicker


