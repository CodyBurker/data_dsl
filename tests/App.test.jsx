import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App.jsx'


describe('App component', () => {
  it('renders Run Script button', () => {
    render(<App />)
    expect(screen.getByText('Run Script')).toBeInTheDocument()
  })
})
