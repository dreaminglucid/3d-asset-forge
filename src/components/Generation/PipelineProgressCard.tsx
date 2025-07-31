import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Progress } from '../common'
import { CheckCircle, Loader2, XCircle, Sparkles, ChevronRight } from 'lucide-react'
import { cn } from '../../styles'
import { PipelineStage } from '../../store'

interface PipelineProgressCardProps {
  pipelineStages: PipelineStage[]
  generationType: 'item' | 'avatar' | undefined
  isGenerating: boolean
  onBackToConfig: () => void
  onBack: () => void
}

export const PipelineProgressCard: React.FC<PipelineProgressCardProps> = ({
  pipelineStages,
  generationType,
  isGenerating,
  onBackToConfig,
  onBack
}) => {
  const filteredStages = pipelineStages.filter(stage => {
    // Hide material variants and sprites for avatar generation
    if (generationType === 'avatar') {
      return stage.id !== 'retexturing' && stage.id !== 'sprites'
    }
    return true
  })

  return (
    <Card className="overflow-hidden shadow-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">Generation Pipeline</CardTitle>
            <CardDescription>Tracking your asset creation progress</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary"
            title="Back to generation type selection"
          >
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-6">
          {filteredStages.map((stage, index) => (
            <PipelineStageItem
              key={stage.id}
              stage={stage}
              isLast={index === filteredStages.length - 1}
            />
          ))}
        </div>
        
        <div className="mt-8 flex justify-center">
          <Button 
            variant="secondary" 
            onClick={onBackToConfig}
            disabled={isGenerating}
            size="lg"
            className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            Back to Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Sub-component for individual pipeline stage
const PipelineStageItem: React.FC<{
  stage: PipelineStage
  isLast: boolean
}> = ({ stage, isLast }) => {
  const isActive = stage.status === 'active'
  const isComplete = stage.status === 'completed'
  const isFailed = stage.status === 'failed'
  const isSkipped = stage.status === 'skipped'

  return (
    <div className="relative">
      <div className={cn(
        "flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-300 hover:scale-[1.01]",
        isActive && "border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-lg animate-pulse",
        isComplete && "border-success bg-gradient-to-r from-success/10 to-success/5",
        isFailed && "border-error bg-gradient-to-r from-error/10 to-error/5",
        isSkipped && "opacity-50 border-border-secondary",
        !isActive && !isComplete && !isFailed && !isSkipped && "border-border-primary hover:border-border-secondary"
      )}>
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full transition-all",
          isActive && "bg-primary text-white shadow-lg scale-110",
          isComplete && "bg-success text-white",
          isFailed && "bg-error text-white",
          isSkipped && "bg-bg-tertiary text-text-muted",
          !isActive && !isComplete && !isFailed && !isSkipped && "bg-bg-tertiary text-text-tertiary"
        )}>
          {isActive ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isComplete ? (
            <CheckCircle className="w-6 h-6" />
          ) : isFailed ? (
            <XCircle className="w-6 h-6" />
          ) : stage.icon ? (
            React.cloneElement(stage.icon as React.ReactElement, {
              className: "w-6 h-6"
            })
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold text-text-primary text-lg">{stage.name}</h4>
          <p className="text-sm text-text-secondary mt-1">{stage.description}</p>
        </div>
        
        {isActive && (
          <div className="flex items-center gap-3">
            <Progress value={50} className="w-32" />
            <span className="text-sm font-medium text-primary animate-pulse">
              Processing...
            </span>
          </div>
        )}
        
        {isComplete && (
          <Badge variant="success" className="text-sm">
            Complete
          </Badge>
        )}
      </div>
      
      {!isLast && (
        <div className={cn(
          "absolute left-7 top-full w-0.5 h-6 -translate-x-1/2 transition-all",
          (isComplete || isActive) ? "bg-primary" : "bg-border-primary"
        )} />
      )}
    </div>
  )
}

export default PipelineProgressCard 