import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs"

export type PlanTab = { value: string; label: string; content: ReactNode }

// Pestañas de la página de precios: una por tipo de plan. Los rótulos pueden ser largos
// («Para agencias y organizadores»), así que se reparten el ancho y pasan a dos líneas en el móvil.
export function PlanTabs({ label, tabs }: { label: string; tabs: PlanTab[] }) {
  return (
    <Tabs defaultValue={tabs[0].value} className="my-6">
      <TabsList aria-label={label} className="h-auto w-full">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="h-auto min-h-9 whitespace-normal py-2 text-center">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
