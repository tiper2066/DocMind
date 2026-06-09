"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none data-[variant=pill]:h-auto data-[variant=pill]:gap-2 data-[variant=pill]:rounded-full data-[variant=pill]:p-0 data-[variant=folder]:relative data-[variant=folder]:h-auto data-[variant=folder]:w-full data-[variant=folder]:justify-start data-[variant=folder]:gap-2 data-[variant=folder]:rounded-none data-[variant=folder]:p-0 data-[variant=folder]:after:absolute data-[variant=folder]:after:inset-x-0 data-[variant=folder]:after:bottom-0 data-[variant=folder]:after:h-px data-[variant=folder]:after:bg-foreground data-[variant=chip]:h-auto data-[variant=chip]:flex-wrap data-[variant=chip]:gap-1.5 data-[variant=chip]:rounded-none data-[variant=chip]:bg-transparent data-[variant=chip]:p-0",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        pill: "bg-transparent",
        folder: "bg-transparent",
        chip: "bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "group-data-[variant=pill]/tabs-list:h-auto group-data-[variant=pill]/tabs-list:flex-none group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:border-hairline group-data-[variant=pill]/tabs-list:px-4 group-data-[variant=pill]/tabs-list:py-2 group-data-[variant=pill]/tabs-list:text-steel group-data-[variant=pill]/tabs-list:hover:text-foreground group-data-[variant=pill]/tabs-list:data-active:border-transparent group-data-[variant=pill]/tabs-list:data-active:bg-ink-deep group-data-[variant=pill]/tabs-list:data-active:text-on-dark group-data-[variant=pill]/tabs-list:data-active:shadow-none dark:group-data-[variant=pill]/tabs-list:data-active:bg-ink-deep dark:group-data-[variant=pill]/tabs-list:data-active:text-on-dark",
        "group-data-[variant=folder]/tabs-list:h-auto group-data-[variant=folder]/tabs-list:flex-none group-data-[variant=folder]/tabs-list:rounded-t-md group-data-[variant=folder]/tabs-list:rounded-b-none group-data-[variant=folder]/tabs-list:border-hairline group-data-[variant=folder]/tabs-list:bg-background group-data-[variant=folder]/tabs-list:px-4 group-data-[variant=folder]/tabs-list:py-2 group-data-[variant=folder]/tabs-list:text-steel group-data-[variant=folder]/tabs-list:hover:text-foreground group-data-[variant=folder]/tabs-list:data-active:z-10 group-data-[variant=folder]/tabs-list:data-active:border-transparent group-data-[variant=folder]/tabs-list:data-active:bg-foreground group-data-[variant=folder]/tabs-list:data-active:text-background group-data-[variant=folder]/tabs-list:data-active:hover:text-background group-data-[variant=folder]/tabs-list:data-active:shadow-none",
        "group-data-[variant=chip]/tabs-list:h-auto group-data-[variant=chip]/tabs-list:flex-none group-data-[variant=chip]/tabs-list:rounded-full group-data-[variant=chip]/tabs-list:border-hairline group-data-[variant=chip]/tabs-list:bg-canvas group-data-[variant=chip]/tabs-list:px-3.5 group-data-[variant=chip]/tabs-list:py-1.5 group-data-[variant=chip]/tabs-list:text-steel group-data-[variant=chip]/tabs-list:hover:text-foreground group-data-[variant=chip]/tabs-list:data-active:border-transparent group-data-[variant=chip]/tabs-list:data-active:bg-primary group-data-[variant=chip]/tabs-list:data-active:text-on-primary group-data-[variant=chip]/tabs-list:data-active:shadow-none dark:group-data-[variant=chip]/tabs-list:data-active:bg-primary dark:group-data-[variant=chip]/tabs-list:data-active:text-on-primary",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
