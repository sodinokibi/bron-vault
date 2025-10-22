import { Badge } from "@/components/ui/badge"
import { Shield, AlertTriangle, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RiskBadgeProps {
  score: number
  level: "Low" | "Medium" | "High" | "Critical"
  showIcon?: boolean
  showScore?: boolean
  factors?: string[]
  size?: "sm" | "md" | "lg"
}

export function RiskBadge({
  score,
  level,
  showIcon = true,
  showScore = false,
  factors = [],
  size = "md"
}: RiskBadgeProps) {
  const getVariant = () => {
    switch (level) {
      case "Critical":
        return "destructive"
      case "High":
        return "destructive"
      case "Medium":
        return "default"
      case "Low":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getIcon = () => {
    switch (level) {
      case "Critical":
        return <AlertTriangle className={getIconSize()} />
      case "High":
        return <AlertTriangle className={getIconSize()} />
      case "Medium":
        return <Info className={getIconSize()} />
      case "Low":
        return <Shield className={getIconSize()} />
      default:
        return <Shield className={getIconSize()} />
    }
  }

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return "h-3 w-3"
      case "md":
        return "h-4 w-4"
      case "lg":
        return "h-5 w-5"
      default:
        return "h-4 w-4"
    }
  }

  const getTextSize = () => {
    switch (size) {
      case "sm":
        return "text-xs"
      case "md":
        return "text-sm"
      case "lg":
        return "text-base"
      default:
        return "text-sm"
    }
  }

  const getBadgeContent = () => (
    <Badge variant={getVariant()} className={`${getTextSize()} gap-1`}>
      {showIcon && getIcon()}
      <span>{level}</span>
      {showScore && <span className="ml-1">({score})</span>}
    </Badge>
  )

  if (factors.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {getBadgeContent()}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-sm mb-2">Risk Factors:</div>
              {factors.map((factor, index) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-current mt-1 flex-shrink-0" />
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return getBadgeContent()
}

interface RiskScoreBarProps {
  score: number
  level: "Low" | "Medium" | "High" | "Critical"
  showLabel?: boolean
}

export function RiskScoreBar({ score, level, showLabel = true }: RiskScoreBarProps) {
  const getColor = () => {
    switch (level) {
      case "Critical":
        return "bg-red-500"
      case "High":
        return "bg-orange-500"
      case "Medium":
        return "bg-yellow-500"
      case "Low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getTextColor = () => {
    switch (level) {
      case "Critical":
        return "text-red-600"
      case "High":
        return "text-orange-600"
      case "Medium":
        return "text-yellow-600"
      case "Low":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Risk Score</span>
          <span className={`text-sm font-semibold ${getTextColor()}`}>
            {score}/100
          </span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
