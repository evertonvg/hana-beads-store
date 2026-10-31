import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormMessage } from "./FormMessage";

const meta = {
  title: "UI/FormMessage",
  component: FormMessage,
} satisfies Meta<typeof FormMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { success: "Dados salvos." } };
export const Failure: Story = { args: { error: "Não foi possível agora. Tente de novo." } };
export const Empty: Story = {};
