import type { ChannelDefinition, ChannelObservation, EcuIdentityObservation, ReadOnlyVehicleTransport, VehicleInterfaceSession } from "./nativeVehicleData.ts";

export type SyntheticRpmMilestone = Readonly<{ validation: "synthetic_not_physical"; connectedSession: VehicleInterfaceSession; ecuIdentityObservation: EcuIdentityObservation; channelDefinition: ChannelDefinition; observations: readonly ChannelObservation[]; disconnectedSession: VehicleInterfaceSession }>;
export type SyntheticMultiChannelMilestone = Readonly<{ validation: "synthetic_not_physical"; connectedSession: VehicleInterfaceSession; ecuIdentityObservation: EcuIdentityObservation; channelDefinitions: readonly ChannelDefinition[]; observations: readonly ChannelObservation[]; disconnectedSession: VehicleInterfaceSession }>;

export async function runSyntheticRpmMilestone(input: { transport: ReadOnlyVehicleTransport; channel: ChannelDefinition; sessionReference: string; startedAt: string; identifiedAt: string; samples: readonly Readonly<{ acquiredAt: string; sequence: number }>[]; endedAt: string }): Promise<SyntheticRpmMilestone> {
  await input.transport.discover(); await input.transport.open({ sessionReference: input.sessionReference, startedAt: input.startedAt }); const connectedSession = await input.transport.connect(); const ecuIdentityObservation = await input.transport.identify({ observedAt: input.identifiedAt });
  if (input.channel.applicability.state !== "qualified" || !input.channel.applicability.dmeFamilies.includes(ecuIdentityObservation.observedDmeFamily ?? "")) throw new Error("RPM channel is not qualified for the observed synthetic DME.");
  const observations = await input.transport.stream(input.channel, input.samples); const disconnectedSession = await input.transport.disconnect({ endedAt: input.endedAt, reason: "synthetic_milestone_complete" });
  return Object.freeze({ validation: "synthetic_not_physical", connectedSession, ecuIdentityObservation, channelDefinition: input.channel, observations: Object.freeze([...observations]), disconnectedSession });
}

export async function runSyntheticMultiChannelMilestone(input: { transport: ReadOnlyVehicleTransport; channels: readonly ChannelDefinition[]; sessionReference: string; startedAt: string; identifiedAt: string; samples: readonly Readonly<{ acquiredAt: string; sequence: number }>[]; endedAt: string }): Promise<SyntheticMultiChannelMilestone> {
  if (input.channels.length === 0) throw new Error("Multi-channel milestone requires at least one channel.");
  await input.transport.discover(); await input.transport.open({ sessionReference: input.sessionReference, startedAt: input.startedAt }); const connectedSession = await input.transport.connect(); const ecuIdentityObservation = await input.transport.identify({ observedAt: input.identifiedAt });
  const family = ecuIdentityObservation.observedDmeFamily ?? "";
  for (const channel of input.channels) if (channel.applicability.state !== "qualified" || !channel.applicability.dmeFamilies.includes(family)) throw new Error(`Channel ${channel.channelKey} is not qualified for the observed synthetic DME.`);
  const channelStreams = await Promise.all(input.channels.map((channel) => input.transport.stream(channel, input.samples)));
  const observations = channelStreams.flat().sort((left, right) => left.acquiredAt.localeCompare(right.acquiredAt) || left.sequence - right.sequence || left.channelRevisionId.localeCompare(right.channelRevisionId));
  const disconnectedSession = await input.transport.disconnect({ endedAt: input.endedAt, reason: "synthetic_multi_channel_milestone_complete" });
  return Object.freeze({ validation: "synthetic_not_physical", connectedSession, ecuIdentityObservation, channelDefinitions: Object.freeze([...input.channels]), observations: Object.freeze(observations), disconnectedSession });
}
