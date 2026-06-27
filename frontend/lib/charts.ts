/**
 * Recharts re-export shim.
 *
 * recharts 2.x ships class-component types that, under React 18's
 * `@types/react` and `strict` mode, trip the TS error:
 *   "JSX element class does not support attributes because it does not have
 *    a 'props' property."
 * This is a known recharts/React-18 typings mismatch, not a runtime issue.
 *
 * Re-exporting the components through `any`-typed aliases keeps full runtime
 * behavior while sidestepping the broken JSX typing — and stays stable across
 * recharts patch versions. Import charts from here instead of "recharts".
 */
import * as Recharts from "recharts";

type AnyComp = (props: any) => any;

const as = (c: unknown) => c as AnyComp;

export const ResponsiveContainer = as(Recharts.ResponsiveContainer);
export const PieChart = as(Recharts.PieChart);
export const Pie = as(Recharts.Pie);
export const Cell = as(Recharts.Cell);
export const BarChart = as(Recharts.BarChart);
export const Bar = as(Recharts.Bar);
export const LineChart = as(Recharts.LineChart);
export const Line = as(Recharts.Line);
export const XAxis = as(Recharts.XAxis);
export const YAxis = as(Recharts.YAxis);
export const Tooltip = as(Recharts.Tooltip);
export const Legend = as(Recharts.Legend);
export const CartesianGrid = as(Recharts.CartesianGrid);
