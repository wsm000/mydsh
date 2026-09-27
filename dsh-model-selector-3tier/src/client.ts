import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

interface ModelOption {
  provider: string
  providerName: string
  model: string
  modelName: string
  effort?: string
  effortName?: string
}

interface ModelSelectorProps {
  onSelect: (option: ModelOption) => void
  currentModel?: string
  currentEffort?: string
}

function ModelSelector({ onSelect, currentModel, currentEffort }: ModelSelectorProps) {
  const [providers, setProviders] = useState<string[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [efforts, setEfforts] = useState<string[]>([])
  
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>(currentModel || '')
  const [selectedEffort, setSelectedEffort] = useState<string>(currentEffort || '')

  useEffect(() => {
    // 从 DSH 设置中读取供应商列表
    const settings = (window as any).__DSH_SETTINGS__
    if (settings?.['llm-pi-ai']?.providers) {
      const providerList = Object.keys(settings['llm-pi-ai'].providers)
      setProviders(providerList)
      if (providerList.length > 0 && !selectedProvider) {
        setSelectedProvider(providerList[0])
      }
    }
  }, [])

  useEffect(() => {
    // 当供应商改变时，更新模型列表
    if (!selectedProvider) return
    
    const settings = (window as any).__DSH_SETTINGS__
    const providerConfig = settings?.['llm-pi-ai']?.providers?.[selectedProvider]
    if (providerConfig?.models) {
      const modelList = providerConfig.models.map((m: any) => ({
        provider: selectedProvider,
        providerName: providerConfig.displayName || selectedProvider,
        model: m.id,
        modelName: m.name || m.id,
      }))
      setModels(modelList)
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].model)
      }
    }
  }, [selectedProvider])

  useEffect(() => {
    // 当模型改变时，更新推理强度列表
    if (!selectedModel) return
    
    const settings = (window as any).__DSH_SETTINGS__
    const providerConfig = settings?.['llm-pi-ai']?.providers?.[selectedProvider]
    const modelConfig = providerConfig?.models?.find((m: any) => m.id === selectedModel)
    
    if (modelConfig?.reasoningEfforts) {
      const effortList = Object.keys(modelConfig.reasoningEfforts)
      setEfforts(effortList)
      if (effortList.length > 0 && !selectedEffort) {
        setSelectedEffort(effortList[0])
      }
    }
  }, [selectedModel])

  const handleConfirm = () => {
    const model = models.find(m => m.model === selectedModel)
    if (model) {
      onSelect({
        ...model,
        effort: selectedEffort,
      })
    }
  }

  return (
    <div className="model-selector-3tier">
      <div className="selector-row">
        <label>供应商：</label>
        <select 
          value={selectedProvider} 
          onChange={(e) => setSelectedProvider(e.target.value)}
        >
          {providers.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      
      <div className="selector-row">
        <label>模型：</label>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {models.map(m => (
            <option key={m.model} value={m.model}>{m.modelName}</option>
          ))}
        </select>
      </div>
      
      {efforts.length > 0 && (
        <div className="selector-row">
          <label>推理强度：</label>
          <select 
            value={selectedEffort} 
            onChange={(e) => setSelectedEffort(e.target.value)}
          >
            {efforts.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      )}
      
      <button onClick={handleConfirm}>确认选择</button>
    </div>
  )
}

export function mountModelSelector(container: HTMLElement, props: ModelSelectorProps) {
  const root = createRoot(container)
  root.render(<ModelSelector {...props} />)
}
