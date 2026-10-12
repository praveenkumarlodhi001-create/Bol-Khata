import Icon from './Icon'

// Bottom navigation ka icon (home | wallet | person). Icon.js font ke bina chalta hai.
export default function TabIcon({ name, color, cut, size = 26 }) {
  return <Icon name={name} size={size} color={color} cut={cut} />
}
