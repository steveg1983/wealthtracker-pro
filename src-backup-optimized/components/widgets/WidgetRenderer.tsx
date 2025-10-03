/**
 * Widget Renderer Component
 * Renders widget instances using the registry
 */

import React, { useEffect } from 'react';
import { widgetRegistryService } from '../../services/widgetRegistryService';
import type { WidgetInstance } from '../../services/widgetRegistryService';
import { useLogger } from '../services/ServiceProvider';

interface WidgetRendererProps {
  instance: WidgetInstance;
  props?: Record<string, unknown>;
}

const WidgetRenderer = React.memo(({ instance, props = {} }: WidgetRendererProps) => {
  const definition = widgetRegistryService.getWidget(instance.type);
  
  if (!definition) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div>Widget type not found: {instance.type}</div>
        </div>
      </div>
    );
  }

  const Component = definition.component;
  
  return (
    <Component 
      {...props} 
      settings={instance.settings}
      size={instance.size}
    />
  );
});

WidgetRenderer.displayName = 'WidgetRenderer';

export default WidgetRenderer;