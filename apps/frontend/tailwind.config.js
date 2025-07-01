module.exports = {
    darkMode: 'class',
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',      // app code
        './components/**/*.{js,ts,jsx,tsx}',   // shadcn-ui components
        './pages/**/*.{js,ts,jsx,tsx}',        // pages dir if present
    ],
    theme: { extend: {} },
    plugins: [require('tw-animate-css')],
}