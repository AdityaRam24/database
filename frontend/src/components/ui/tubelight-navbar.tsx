"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  color?: string
  textColor?: string
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const pathname = usePathname()
  
  // Find which tab corresponds to the current pathname, fallback to items[0].name
  const currentTab = items.find(item => item.url === pathname)?.name || items[0].name
  const [activeTab, setActiveTab] = useState(currentTab)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setActiveTab(currentTab)
  }, [currentTab])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 sm:gap-2 relative z-50 overflow-x-auto py-1",
        className,
      )}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative flex items-center justify-center cursor-pointer text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-full transition-all duration-300 shrink-0",
                "text-zinc-500 hover:text-zinc-300",
              )}
              style={{
                color: isActive ? (item.textColor || '#fff') : undefined,
                background: isActive ? (item.color ? `${item.color}18` : 'rgba(255,255,255,0.05)') : 'transparent',
                border: isActive ? `1px solid ${item.color}40` : '1px solid transparent'
              }}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} strokeWidth={2.5} style={{ color: isActive ? item.color : undefined }} />
                <span className="hidden md:inline whitespace-nowrap">{item.name}</span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  style={{ background: item.color ? `${item.color}05` : 'rgba(255,255,255,0.05)' }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full" style={{ background: item.color || '#fff' }}>
                    <div className="absolute w-12 h-6 rounded-full blur-md -top-2 -left-2" style={{ background: item.color ? `${item.color}33` : 'rgba(255,255,255,0.2)' }} />
                    <div className="absolute w-8 h-6 rounded-full blur-md -top-1" style={{ background: item.color ? `${item.color}33` : 'rgba(255,255,255,0.2)' }} />
                    <div className="absolute w-4 h-4 rounded-full blur-sm top-0 left-2" style={{ background: item.color ? `${item.color}33` : 'rgba(255,255,255,0.2)' }} />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
    </div>
  )
}
