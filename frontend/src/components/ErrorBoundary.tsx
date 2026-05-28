import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className='flex min-h-dvh items-center justify-center p-8'>
        <div className='max-w-md text-center'>
          <Icon name='AlertCircle' size={24} className='mx-auto text-danger' />
          <h1 className='mt-4 text-xl font-semibold text-fg'>Erreur de chargement</h1>
          <p className='mt-2 text-sm text-fg-muted'>
            Une erreur inattendue s'est produite. Rechargez la page pour réessayer.
          </p>
          <div className='mt-6 flex justify-center gap-3'>
            <Button variant='primary' onClick={this.reset}>
              <Icon name='RotateCw' size={16} />
              Recharger
            </Button>
            <Button variant='secondary' onClick={() => (window.location.href = '/workflows')}>
              Retour à la liste
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
