import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  showText?: boolean
  className?: string
  animated?: boolean
  subtitle?: string
}

export function BrandLogo({ size = "md", showText = true, className, animated = false, subtitle }: BrandLogoProps) {
  const sizeConfig = {
    sm: { icon: "h-3.5 w-3.5", container: "h-6 w-6", text: "text-sm" },
    md: { icon: "h-5 w-5", container: "h-9 w-9", text: "text-base" },
    lg: { icon: "h-7 w-7", container: "h-11 w-11", text: "text-lg" },
    xl: { icon: "h-9 w-9", container: "h-14 w-14", text: "text-xl" },
  }

  const config = sizeConfig[size]

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-400/20 shadow-none",
          config.container,
          animated && "animate-pulse-slow",
        )}
      >
        <Zap className={cn(config.icon, animated && "animate-bounce-gentle")} />
      </div>
      {showText && (
        <div className="flex flex-col select-none">
          <span className={cn("font-extrabold tracking-wider text-foreground leading-none", config.text)}>
            SMART VISITOR
          </span>
          {subtitle ? (
            <span className="text-[9px] tracking-[0.2em] text-muted-foreground/80 font-bold uppercase mt-1 leading-none">
              {subtitle.split("").join(" ")}
            </span>
          ) : (
            size !== "sm" && (
              <span className="text-[9px] tracking-[0.15em] text-primary font-bold uppercase mt-1 leading-none">
                M A N A G E M E N T
              </span>
            )
          )}
        </div>
      )}
    </div>
  )
}
