import '@picocss/pico/css/pico.classless.min.css'
import '@fontsource-variable/manrope'
import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

/** Start the search demo inside the page's application element. */
mount(App, { target: document.getElementById('app') })
