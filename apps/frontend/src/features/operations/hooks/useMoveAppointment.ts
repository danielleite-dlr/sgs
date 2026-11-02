import { useCallback } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import {
  MoveAppointmentMutation,
  type AppointmentData,
  type MoveAppointmentResult,
} from "../api/appointments.api";

export interface MoveTarget {
  professionalId: string;
  professionalName: string;
  startsAt: Date;
}

/**
 * Move um agendamento (D-04): atualiza o cache na hora via optimisticResponse e,
 * se o servidor recusar (errors[] ou rede), a camada otimista cai sozinha e o
 * card volta. Nunca escreve no cache manualmente (a resposta com appointment
 * null nao toca a entidade).
 */
export function useMoveAppointment() {
  const [mutate] = useMutation<MoveAppointmentResult>(MoveAppointmentMutation);

  return useCallback(
    async (appointment: AppointmentData, target: MoveTarget): Promise<boolean> => {
      const duration =
        new Date(appointment.endsAt).getTime() -
        new Date(appointment.startsAt).getTime();
      const startsAt = target.startsAt.toISOString();
      const endsAt = new Date(target.startsAt.getTime() + duration).toISOString();
      try {
        const { data } = await mutate({
          variables: {
            input: {
              id: appointment.id,
              professionalId: target.professionalId,
              startsAt,
            },
          },
          optimisticResponse: {
            moveAppointment: {
              __typename: "AppointmentPayload",
              appointment: {
                ...appointment,
                __typename: "Appointment",
                professionalId: target.professionalId,
                professional: {
                  __typename: "Member",
                  id: target.professionalId,
                  displayName: target.professionalName,
                },
                startsAt,
                endsAt,
              },
              errors: [],
            },
          } as unknown as MoveAppointmentResult,
        });
        const errors = data?.moveAppointment.errors ?? [];
        if (errors.length > 0) {
          toast.error(`Não foi possível mover: ${errors[0].message}`);
          return false;
        }
        toast.success("Agendamento movido.");
        return true;
      } catch (e) {
        toast.error(
          `Não foi possível mover: ${e instanceof Error ? e.message : "erro desconhecido"}`,
        );
        return false;
      }
    },
    [mutate],
  );
}
