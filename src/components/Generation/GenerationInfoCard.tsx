import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../common'
import { Info } from 'lucide-react'

export const GenerationInfoCard: React.FC = () => {
  return (
    <Card className="overflow-hidden shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          Generation Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="font-medium text-text-primary mb-2">What happens next?</h4>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>AI will enhance your prompts for better results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Concept art will be generated based on your description</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>3D model will be created from the concept art</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Material variants and sprites can be generated</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 