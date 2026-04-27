import { createRoot } from 'react-dom/client'
import './index.css'
// import './styles/theme-dark.css'  // 다크 테마. 적용 시 이 줄과 아래 줄 주석 해제
import App from './App.tsx'

// document.body.classList.add('theme-dark')  // 다크 테마 활성화

createRoot(document.getElementById('root')!).render(<App />)
