import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createElement } from 'react'
import { colors as baseColors } from './colors'

const Ctx=createContext({mode:'light',setMode:()=>{},accent:'green',setAccent:()=>{},colors:baseColors})
const palettes={
 green:{milk:'#2E6E5E',milkDark:'#1F4D41',milkLight:'#E3F1EC',gradient:['#2E6E5E','#1F4D41']},
 blue:{milk:'#2764A5',milkDark:'#1D4778',milkLight:'#E3EEFA',gradient:['#2764A5','#1D4778']},
 purple:{milk:'#7351A6',milkDark:'#4F347B',milkLight:'#EEE7F8',gradient:['#7351A6','#4F347B']},
 orange:{milk:'#B96725',milkDark:'#81451B',milkLight:'#FBEBDD',gradient:['#B96725','#81451B']}
}
export function ThemeProvider({children}) {
 const [mode,setModeState]=useState('light')
 const [accent,setAccentState]=useState('green')
 useEffect(()=>{Promise.all([AsyncStorage.getItem('vk_theme'),AsyncStorage.getItem('vk_accent')]).then(([m,a])=>{if(m==='dark'||m==='light')setModeState(m);if(palettes[a])setAccentState(a)}).catch(()=>{})},[])
 const setMode=v=>{setModeState(v);AsyncStorage.setItem('vk_theme',v).catch(()=>{})}
 const setAccent=v=>{if(!palettes[v])return;setAccentState(v);AsyncStorage.setItem('vk_accent',v).catch(()=>{})}
 const colors=useMemo(()=>({...baseColors,...palettes[accent],bg:mode==='dark'?'#111916':'#F6F8F5',panel:mode==='dark'?'#1D2722':'#FFFFFF',ink:mode==='dark'?'#F0F5F2':'#1E2A25',inkSoft:mode==='dark'?'#B8C5BE':'#59675F',line:mode==='dark'?'#34423A':'#E5ECE7',gradient:palettes[accent].gradient}),[mode,accent])
 const value=useMemo(()=>({mode,setMode,accent,setAccent,colors}),[mode,accent,colors])
 return createElement(Ctx.Provider,{value},children)
}
export const useTheme=()=>useContext(Ctx)
export function useThemedStyles(factory){const {colors}=useTheme();return {colors,styles:factory(colors)}}
