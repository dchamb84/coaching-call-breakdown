import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './coaching-analyser'

// Polyfill window.storage to use localStorage
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key)
      return value ? { value } : null
    },
    set: async (key, value) => {
      localStorage.setItem(key, value)
      return { success: true }
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
