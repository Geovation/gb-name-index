import { mount } from 'svelte'
import App from './App.svelte'

/** Mount the interactive name-index harness into its HTML application root. */
mount(App, { target: document.getElementById('app') })
