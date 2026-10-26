import { Component } from 'react'
import PaginaError from './PaginaError'

// Atrapa errores de render no controlados y muestra la página 500 con la mascota.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hayError: false }
  }

  static getDerivedStateFromError() {
    return { hayError: true }
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado:', error, info)
  }

  render() {
    if (this.state.hayError) {
      return (
        <div className="contenedor main">
          <PaginaError
            codigo={500}
            mensaje="Se nos derramó el café: algo se rompió al mostrar esta pantalla."
          />
        </div>
      )
    }
    return this.props.children
  }
}
