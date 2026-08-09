"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CodeTabsProps {
  tabs: { value: string; label: string; code: string }[];
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute top-2.5 right-2.5 text-white/50 hover:bg-white/10 hover:text-white"
      aria-label="Copy code"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function CodeTabs({ tabs }: CodeTabsProps) {
  return (
    <Tabs defaultValue={tabs[0]?.value}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <div className="relative overflow-hidden rounded-xl bg-navy-900">
            <CopyButton code={tab.code} />
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-navy-100">
              <code>{tab.code}</code>
            </pre>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
