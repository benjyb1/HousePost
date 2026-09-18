'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { DesignOptionChooser, type DesignOption } from '@/components/postcards/DesignOptionChooser'
import { SvgTemplateEditor } from '@/components/postcards/SvgTemplateEditor'
import { UploadCustomDesign } from '@/components/postcards/UploadCustomDesign'
import { CustomDesignBrief } from '@/components/postcards/CustomDesignBrief'
import { DesignLibrary } from '@/components/postcards/DesignLibrary'

const HEADINGS: Record<DesignOption, { title: string; subtitle: string }> = {
  template: {
    title: 'Use a template',
    subtitle: 'Pick a design, personalise it in the browser, and save a matching front and back.',
  },
  upload: {
    title: 'Upload custom design',
    subtitle: 'Upload your own print-ready front and back artwork.',
  },
  request: {
    title: 'Request custom design',
    subtitle: 'Tell us about your brand and we’ll design your postcard for you.',
  },
}

export default function PostcardDesignPage() {
  const [option, setOption] = useState<DesignOption | null>(null)
  // Which side the uploader opens on. "Add a back design" from the template
  // editor lands straight on the Back tab instead of the Front one.
  const [uploadSide, setUploadSide] = useState<'front' | 'back'>('front')

  function goToUpload(side: 'front' | 'back' = 'front') {
    setUploadSide(side)
    setOption('upload')
  }

  return (
    <div className="max-w-6xl space-y-6">
      {option === null ? (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Postcard design</h1>
            <p className="text-sm text-slate-500">
              Choose how you&apos;d like to create your postcard. You can always come back and switch approach.
            </p>
          </div>
          <DesignOptionChooser onSelect={setOption} />
          <DesignLibrary onGoToUpload={() => goToUpload('front')} />
        </>
      ) : (
        <>
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOption(null)}
              className="-ml-2 text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              All design options
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{HEADINGS[option].title}</h1>
              <p className="text-sm text-slate-500">{HEADINGS[option].subtitle}</p>
            </div>
          </div>

          {option === 'template' && (
            <SvgTemplateEditor
              onUseUpload={() => goToUpload('front')}
              onAddBack={() => goToUpload('back')}
              onBackToOptions={() => setOption(null)}
            />
          )}
          {option === 'upload' && (
            <UploadCustomDesign initialSide={uploadSide} onBackToOptions={() => setOption(null)} />
          )}
          {option === 'request' && <CustomDesignBrief />}
        </>
      )}
    </div>
  )
}
