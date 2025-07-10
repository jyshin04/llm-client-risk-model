import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/inter';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const theme = createTheme({
  typography: {
    fontFamily: 'Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body1: { fontWeight: 400 },
    body2: { fontWeight: 400 },
    button: { fontWeight: 600 },
  },
  palette: {
    primary: {
      main: '#5B21B6', // deep purple
    },
    secondary: {
      main: '#0EA5E9', // blue
    },
    background: {
      default: '#F8FAFC',
      paper: '#fff',
    },
  },
  shape: {
    borderRadius: 12,
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
