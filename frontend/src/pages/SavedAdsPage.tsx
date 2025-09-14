import React from 'react'
import { Bookmark, Heart, Tag, Folder } from 'lucide-react'

export function SavedAdsPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold holographic-title">
          <Bookmark className="inline w-8 h-8 mr-3" />
          Saved Ads
        </h1>
        <p className="text-gray-400 mt-2">
          Your curated collection of winning ads
        </p>
      </div>
      
      <div className="text-center py-20">
        <Bookmark className="w-24 h-24 mx-auto text-gray-600 mb-4" />
        <h3 className="text-2xl font-medium text-gray-400">Coming Soon</h3>
        <p className="text-gray-500 mt-2">
          Save and organize your favorite ads here
        </p>
      </div>
    </div>
  )
}
