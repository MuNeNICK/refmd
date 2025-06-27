export function formatPublicDate(dateString: string | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December']
  
  const year = date.getFullYear()
  const month = months[date.getMonth()]
  const day = date.getDate()
  
  return `${month} ${day}, ${year}`
}