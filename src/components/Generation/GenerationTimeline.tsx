import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../common'
import { Clock } from 'lucide-react'

export const GenerationTimeline: React.FC = () => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Generation Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
            <span className="text-sm text-text-secondary">Started</span>
            <span className="text-sm font-medium text-text-primary">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
            <span className="text-sm text-text-secondary">Estimated completion</span>
            <span className="text-sm font-medium text-text-primary">
              ~5-10 minutes
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 