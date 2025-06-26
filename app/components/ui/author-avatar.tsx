import React from 'react'
import { Avatar, AvatarFallback } from './avatar'

interface AuthorAvatarProps {
  name?: string | null
  className?: string
}

export function AuthorAvatar({ name, className }: AuthorAvatarProps) {
  const initials = name?.charAt(0) || '?'
  
  return (
    <Avatar className={className}>
      <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}