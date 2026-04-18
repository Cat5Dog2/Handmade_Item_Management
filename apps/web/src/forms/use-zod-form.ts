import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options: UseFormProps<z.input<TSchema>> = {}
) {
  return useForm<z.input<TSchema>, undefined, z.output<TSchema>>({
    ...options,
    resolver: zodResolver(schema)
  });
}
