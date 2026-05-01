'use client'
import dynamic from 'next/dynamic'
const MultiSource = dynamic(() => import('@/components/MultiSource'), { ssr: false })
export default function Page() { return <MultiSource /> }