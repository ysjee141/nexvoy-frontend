'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isBetaTester } from '@/constants/testers'

export function useBugReport() {
    const [isOpen, setIsOpen] = useState(false)
    const [user, setUser] = useState<any>(null)
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    const excludedPaths = ['/profile/licenses', '/profile/withdrawal', '/signup', '/login']
    const isExcluded = excludedPaths.includes(pathname)
    
    const isVisible = !!user && isBetaTester(user.id) && !isExcluded

    return {
        isOpen,
        setIsOpen,
        user,
        isVisible,
        pathname
    }
}
