import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'

export default function NotFound() {
  return (
    <div className='flex min-h-[calc(100dvh-48px)] items-center justify-center p-8'>
      <div className='max-w-md text-center'>
        <Icon name='MapPinOff' size={24} className='mx-auto text-fg-muted' />
        <h1 className='mt-4 text-2xl font-semibold text-fg'>Page introuvable</h1>
        <p className='mt-2 text-sm text-fg-muted'>Cette page n'existe pas ou a été déplacée.</p>
        <Link
          to='/workflows'
          className='mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        >
          Retour aux workflows
        </Link>
      </div>
    </div>
  )
}
