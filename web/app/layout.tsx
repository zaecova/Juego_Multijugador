import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'En busca del tesoro',description:'Una aventura multijugador en la selva. Reúne las pistas y alcanza el tesoro.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
