'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DesignOptionChooser, type DesignOption } from '@/components/postcards/DesignOptionChooser'
import { SvgTemplateEditor } from '@/components/postcards/SvgTemplateEditor'
import { UploadCustomDesign } from '@/components/postcards/UploadCustomDesign'
import { CustomDesignBrief } from '@/components/postcards/CustomDesignBrief'
import { DesignLibrary } from '@/components/postcards/DesignLibrary'
import { useLeaveGuard } from '@/components/layout/LeaveGuardProvider'
import { parseSidecar, type TemplateSidecar } from '@/components/postcards/template-sidecar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import chrome from '@/components/portal/page-chrome.module.css'

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
  // The template editor reports unsaved edits straight to the portal-wide guard,
  // which asks before we leave them behind (page back, sidebar, browser Back, Sign-out).
  const { setDirty, guard } = useLeaveGuard()
  // A saved template being reopened for editing (the library's "Edit"). Cleared
  // whenever we leave the editor or start a template fresh, so a later fresh
  // "Use a template" never resumes a stale design.
  const [resumeSidecar, setResumeSidecar] = useState<TemplateSidecar | null>(null)
  const supabase = createClient()

  function goToUpload(side: 'front' | 'back' = 'front') {
    setUploadSide(side)
    setOption('upload')
  }

  // Leaving the editor: drop any resume so re-entering a template starts clean.
  function backToOptions() {
    setResumeSidecar(null)
    setOption(null)
  }

  // The library's "Edit" on a saved template: load its editor sidecar and reopen
  // it in the template editor (the editor's mount effect applies `resume`). A row
  // saved before in-browser editing existed has no sidecar — say so, don't crash.
  async function handleEditTemplate(design: { id: string }) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('no-user')
      const path = `${user.id}/design-editor/${design.id}.json`
      const { publicUrl } = supabase.storage.from('postcard-designs').getPublicUrl(path).data
      const res = await fetch(`${publicUrl}?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('missing')
      const sidecar = parseSidecar(await res.text())
      if (!sidecar) throw new Error('invalid')
      setResumeSidecar(sidecar)
      setOption('template')
    } catch {
      toast('This design was saved before in-browser editing, so it can’t be reopened to edit.')
    }
  }

  return (
    <div className={chrome.page}>
      {/* The designer components below were laid out for this width; keep it. */}
      <div className="flex max-w-6xl flex-col gap-6">
        {option === null ? (
          <>
            <div>
              <div className={`${chrome.title} ${chrome.titleFlush}`}>
                <h1>Designs</h1>
              </div>
              <p className={chrome.intro}>
                Choose how to make your postcard. You can come back and switch approach any time.
              </p>
            </div>
            <DesignOptionChooser
              onSelect={(opt) => {
                setResumeSidecar(null)
                setOption(opt)
              }}
            />
            <DesignLibrary
              onGoToUpload={() => goToUpload('front')}
              onEditTemplate={handleEditTemplate}
            />
          </>
        ) : (
          <>
            <div>
              <button
                type="button"
                onClick={() => guard(backToOptions)}
                className={`${chrome.textbtn} -ml-1 mb-2`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All designs
              </button>
              <div className={`${chrome.title} ${chrome.titleFlush}`}>
                <h1>{HEADINGS[option].title}</h1>
              </div>
              <p className={chrome.intro}>{HEADINGS[option].subtitle}</p>
            </div>

            {option === 'template' && (
              <SvgTemplateEditor
                onUseUpload={() => goToUpload('front')}
                onAddBack={() => goToUpload('back')}
                onBackToOptions={backToOptions}
                onDirtyChange={setDirty}
                guard={guard}
                resume={resumeSidecar}
              />
            )}
            {option === 'upload' && (
              <UploadCustomDesign initialSide={uploadSide} onBackToOptions={() => setOption(null)} />
            )}
            {option === 'request' && <CustomDesignBrief />}
          </>
        )}
      </div>
    </div>
  )
}
