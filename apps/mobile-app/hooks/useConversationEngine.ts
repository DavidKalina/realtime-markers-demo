import { useCallback, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────────── */

export interface OptionChoice {
  label: string;
  value: string;
  emoji?: string;
}

export type TriggerSource =
  | "open"
  | "page-change"
  | "anchor-added"
  | "custom"
  | (string & {});

/**
 * Render hint for the middle content zone.
 * Steps can specify what kind of content to show between the
 * narrator bubble and the input area.
 *
 * - `"options"` — render the step's `options` as tappable chips (default when options exist).
 * - `"none"` — empty middle zone (text-only prompt).
 * - Custom string — your component can switch on this to render anything.
 */
export type ContentType = "options" | "none" | (string & {});

/**
 * A step in the conversation script.
 *
 * - `prompt` / `promptFn`: the narrator text (streamed char-by-char in the top bubble).
 * - `options`: tappable choices rendered in the middle content zone.
 * - `contentType`: hint for what to render in the middle zone (default: "options" if options exist, "none" otherwise).
 * - `onResponse`: called when the user sends text or picks an option.
 *    Return a string, step, or array of steps to inject dynamically.
 * - `delayMs`: pause before streaming this step (default 400ms).
 * - `inputPlaceholder`: custom placeholder for the bottom text input.
 * - `hideInput`: hide the text input for this step (e.g. options-only).
 */
export interface ConversationStep {
  prompt?: string;
  promptFn?: (context: ConversationContext) => string;
  options?: OptionChoice[];
  contentType?: ContentType;
  onResponse?: (
    response: string,
    context: ConversationContext,
  ) => string | ConversationStep | ConversationStep[] | void;
  delayMs?: number;
  inputPlaceholder?: string;
  hideInput?: boolean;
  /** Allow selecting multiple options before confirming (response is comma-separated values) */
  multiSelect?: boolean;
}

export interface ConversationContext {
  /** All user responses so far, keyed by the step index that requested them */
  responses: Record<number, string>;
  /** The trigger that started this conversation */
  trigger: TriggerSource;
  /** Arbitrary metadata passed in by the caller */
  meta: Record<string, unknown>;
  /** Current step index */
  stepIndex: number;
}

export interface ConversationEngineConfig {
  /** Character-by-character stream speed in ms (default 25) */
  streamSpeed?: number;
}

/* ── Engine state exposed to consumers ─────────────────────── */

export interface EngineState {
  /** The current narrator text (progressively revealed) */
  displayText: string;
  /** True while the narrator text is still streaming */
  isStreaming: boolean;
  /** True when the engine is waiting for user input */
  waitingForUser: boolean;
  /** Options for the current step (shown in middle zone) */
  currentOptions: OptionChoice[] | null;
  /** Content type hint for the middle zone */
  contentType: ContentType;
  /** Placeholder text for the input bar */
  inputPlaceholder: string;
  /** Whether the input bar should be hidden */
  hideInput: boolean;
  /** Whether the current step allows multi-select */
  multiSelect: boolean;
  /** Whether a conversation is active */
  isActive: boolean;
  /** Current step index */
  stepIndex: number;
  /** Full context (responses, trigger, meta) */
  context: ConversationContext;
  /** Start a conversation */
  start: (
    steps: ConversationStep[],
    trigger?: TriggerSource,
    meta?: Record<string, unknown>,
  ) => void;
  /** Submit a user response (text or option value) */
  respond: (text: string) => void;
  /** Reset / stop */
  reset: () => void;
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useConversationEngine(
  config?: ConversationEngineConfig,
): EngineState {
  const streamSpeed = config?.streamSpeed ?? 25;

  const [displayText, setDisplayText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<OptionChoice[] | null>(
    null,
  );
  const [contentType, setContentType] = useState<ContentType>("none");
  const [inputPlaceholder, setInputPlaceholder] = useState("Type a response...");
  const [hideInput, setHideInput] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Refs for managing the streaming lifecycle
  const stepsRef = useRef<ConversationStep[]>([]);
  const stepIndexRef = useRef(0);
  const responsesRef = useRef<Record<number, string>>({});
  const triggerRef = useRef<TriggerSource>("custom");
  const metaRef = useRef<Record<string, unknown>>({});
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);

  const getContext = useCallback((): ConversationContext => ({
    responses: { ...responsesRef.current },
    trigger: triggerRef.current,
    meta: metaRef.current,
    stepIndex: stepIndexRef.current,
  }), []);

  const cleanup = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    abortRef.current = true;
  }, []);

  /** Stream text into the narrator bubble, replacing previous content. */
  const streamText = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        setDisplayText("");
        setIsStreaming(true);

        let charIdx = 0;
        const tick = () => {
          if (abortRef.current) {
            resolve();
            return;
          }
          if (charIdx < text.length) {
            charIdx++;
            setDisplayText(text.slice(0, charIdx));
            streamTimerRef.current = setTimeout(tick, streamSpeed);
          } else {
            setIsStreaming(false);
            resolve();
          }
        };
        streamTimerRef.current = setTimeout(tick, streamSpeed);
      });
    },
    [streamSpeed],
  );

  /** Advance to the next step in the script. */
  const advanceStep = useCallback(async () => {
    const steps = stepsRef.current;
    const idx = stepIndexRef.current;

    if (idx >= steps.length || abortRef.current) {
      setWaitingForUser(false);
      setCurrentOptions(null);
      setMultiSelect(false);
      // Don't reset contentType/hideInput — preserve the last step's state
      return;
    }

    const step = steps[idx];
    setStepIndex(idx);

    // Apply step config to middle/bottom zones (hidden until streaming finishes)
    const stepContentType = step.contentType ?? (step.options ? "options" : "none");
    setCurrentOptions(null);
    setContentType("none");
    setWaitingForUser(false);
    setHideInput(true);
    setMultiSelect(false);
    setInputPlaceholder(step.inputPlaceholder ?? "Type a response...");

    // Resolve prompt text
    const text = step.promptFn ? step.promptFn(getContext()) : (step.prompt ?? "");

    // Delay before streaming
    const delay = step.delayMs ?? 400;
    await new Promise<void>((r) => {
      streamTimerRef.current = setTimeout(r, delay);
    });

    if (abortRef.current) return;

    // Stream the narrator text
    await streamText(text);

    if (abortRef.current) return;

    // Now reveal the middle zone and input
    setContentType(stepContentType);
    setCurrentOptions(step.options ?? null);
    setHideInput(step.hideInput ?? false);
    setMultiSelect(step.multiSelect ?? false);

    // If step expects user input, wait
    if (step.options || step.onResponse) {
      setWaitingForUser(true);
    } else {
      // Auto-advance
      stepIndexRef.current = idx + 1;
      await advanceStep();
    }
  }, [streamText, getContext]);

  /** Start a conversation with a set of steps. */
  const start = useCallback(
    (
      steps: ConversationStep[],
      trigger: TriggerSource = "custom",
      meta?: Record<string, unknown>,
    ) => {
      cleanup();
      abortRef.current = false;
      stepsRef.current = steps;
      stepIndexRef.current = 0;
      responsesRef.current = {};
      triggerRef.current = trigger;
      metaRef.current = meta ?? {};
      setDisplayText("");
      setIsStreaming(false);
      setWaitingForUser(false);
      setCurrentOptions(null);
      setContentType("none");
      setHideInput(true);
      setMultiSelect(false);
      setStepIndex(0);
      setIsActive(true);

      advanceStep();
    },
    [advanceStep, cleanup],
  );

  /** User sends a text response or picks an option. */
  const respond = useCallback(
    (text: string) => {
      if (!waitingForUser) return;

      const idx = stepIndexRef.current;
      responsesRef.current[idx] = text;

      setWaitingForUser(false);
      setCurrentOptions(null);
      setContentType("none");
      setHideInput(true);

      const step = stepsRef.current[idx];

      if (step?.onResponse) {
        const result = step.onResponse(text, getContext());
        if (result) {
          const newSteps: ConversationStep[] =
            typeof result === "string"
              ? [{ prompt: result }]
              : Array.isArray(result)
                ? result
                : [result];

          // Splice new steps after current index
          const remaining = stepsRef.current.slice(idx + 1);
          stepsRef.current = [
            ...stepsRef.current.slice(0, idx + 1),
            ...newSteps,
            ...remaining,
          ];
        }
      }

      stepIndexRef.current = idx + 1;
      advanceStep();
    },
    [waitingForUser, advanceStep, getContext],
  );

  /** Reset / stop the conversation. */
  const reset = useCallback(() => {
    cleanup();
    setDisplayText("");
    setIsStreaming(false);
    setWaitingForUser(false);
    setCurrentOptions(null);
    setContentType("none");
    setHideInput(true);
    setMultiSelect(false);
    setStepIndex(0);
    setIsActive(false);
  }, [cleanup]);

  return {
    displayText,
    isStreaming,
    waitingForUser,
    currentOptions,
    contentType,
    inputPlaceholder,
    hideInput,
    multiSelect,
    isActive,
    stepIndex,
    context: getContext(),
    start,
    respond,
    reset,
  };
}
