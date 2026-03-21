import { redirect } from 'next/navigation'

export default function Page({ searchParams }: { searchParams: { id?: string } }) {
    if (searchParams.id) {
        redirect(`/trips/detail?id=${searchParams.id}&tab=checklist`)
    }
    redirect('/')
}
