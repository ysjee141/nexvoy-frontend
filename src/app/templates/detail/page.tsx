import { Suspense } from 'react'
import ClientPage from './TemplateClient'
import { createClient } from '@/utils/supabase/server'
import { TemplateFormSkeleton } from '@/components/template/TemplateFormSkeleton'

export default async function Page({ 
    searchParams 
}: { 
    searchParams: Promise<{ id: string }> 
}) {
    const { id: templateId } = await searchParams

    if (!templateId) {
        return <ClientPage initialData={null} />
    }

    const supabase = await createClient()
    const { data: template } = await supabase
        .from('checklist_templates')
        .select(`
            id, 
            title, 
            checklist_template_items (id, item_name, category)
        `)
        .eq('id', templateId)
        .single()

    return (
        <Suspense fallback={<TemplateFormSkeleton />}>
            <ClientPage initialData={template} />
        </Suspense>
    )
}
