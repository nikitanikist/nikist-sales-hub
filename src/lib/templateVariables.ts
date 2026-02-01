// Known auto-filled variables
export const AUTO_FILLED_VARIABLES = ['workshop_name', 'date', 'time'];

// Human-readable labels for known variables
export const VARIABLE_LABELS: Record<string, string> = {
  'workshop_name': 'Workshop Name',
  'date': 'Date',
  'time': 'Time',
  'zoom_link': 'Zoom Meeting Link',
  'whatsapp_group_link': 'WhatsApp Group Invite Link',
  'youtube_link': 'YouTube Live Link',
  'telegram_link': 'Telegram Group Link',
  'meet_link': 'Google Meet Link',
};

/**
 * Get human-readable label for a variable key
 */
export function getVariableLabel(key: string): string {
  return VARIABLE_LABELS[key] || 
    key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Extract all {variable} patterns from template content
 */
export function extractVariables(content: string): string[] {
  const regex = /\{([a-z_]+)\}/gi;
  const matches = content.match(regex) || [];
  // Remove braces and deduplicate
  return [...new Set(matches.map(m => m.slice(1, -1).toLowerCase()))];
}

/**
 * Separate variables into auto-filled and manual categories
 */
export function categorizeVariables(allVariables: string[]): {
  autoFilled: string[];
  manual: string[];
} {
  const autoFilled = allVariables.filter(v => AUTO_FILLED_VARIABLES.includes(v));
  const manual = allVariables.filter(v => !AUTO_FILLED_VARIABLES.includes(v));
  return { autoFilled, manual };
}

/**
 * Extract all variables from all templates in a sequence
 */
export function extractSequenceVariables(
  steps: Array<{ template?: { content: string } | null }>
): {
  autoFilled: string[];
  manual: string[];
} {
  const allVars = new Set<string>();
  steps.forEach(step => {
    if (step.template?.content) {
      extractVariables(step.template.content).forEach(v => allVars.add(v));
    }
  });
  return categorizeVariables([...allVars]);
}

/**
 * Replace all variables in content with their values
 */
export function replaceVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(
      new RegExp(`\\{${key}\\}`, 'gi'),
      value
    );
  }
  return result;
}

/**
 * Extract all variables from SMS sequence steps (which use {key, label} format)
 */
export function extractSMSSequenceVariables(
  steps: Array<{ template?: { variables: Array<{ key: string; label: string }> | null } | null }>
): {
  autoFilled: Array<{ key: string; label: string }>;
  manual: Array<{ key: string; label: string }>;
} {
  const allVarsMap = new Map<string, { key: string; label: string }>();
  
  steps.forEach(step => {
    const vars = step.template?.variables;
    if (vars && Array.isArray(vars)) {
      vars.forEach(v => {
        if (v.key && !allVarsMap.has(v.key)) {
          allVarsMap.set(v.key, v);
        }
      });
    }
  });

  const allVars = Array.from(allVarsMap.values());
  
  // Auto-filled: common variables like name (per-registrant), workshop_name, date, time
  const autoFilledKeys = ['name', 'workshop_name', 'date', 'time'];
  const autoFilled = allVars.filter(v => 
    autoFilledKeys.includes(v.key) || 
    v.label?.toLowerCase().includes('name') ||
    v.label?.toLowerCase().includes('date') ||
    v.label?.toLowerCase().includes('time')
  );
  
  // Manual: everything else (zoom links, whatsapp group links, etc.)
  const autoFilledKeySet = new Set(autoFilled.map(v => v.key));
  const manual = allVars.filter(v => !autoFilledKeySet.has(v.key));
  
  return { autoFilled, manual };
}
