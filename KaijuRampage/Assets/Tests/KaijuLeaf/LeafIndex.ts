import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {K1_MainMenuScenario} from "./K1_MainMenuScenario"
import {K2_StartReachScenario} from "./K2_StartReachScenario"
import {K3_RightSideHudScenario} from "./K3_RightSideHudScenario"
import {K4_TrackedPunchScenario} from "./K4_TrackedPunchScenario"
import {K5_DamageWarningScenario} from "./K5_DamageWarningScenario"
import {K6_GameOverRestartScenario} from "./K6_GameOverRestartScenario"
import {K7_UpgradeScenario} from "./K7_UpgradeScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "k1-main-menu", typename: K1_MainMenuScenario.getTypeName()},
    {id: "k2-start-ik-reach", typename: K2_StartReachScenario.getTypeName()},
    {id: "k3-right-side-hud", typename: K3_RightSideHudScenario.getTypeName()},
    {id: "k4-tracked-punch", typename: K4_TrackedPunchScenario.getTypeName()},
    {id: "k5-damage-warning", typename: K5_DamageWarningScenario.getTypeName()},
    {id: "k6-game-over-restart", typename: K6_GameOverRestartScenario.getTypeName()},
    {id: "k7-upgrade", typename: K7_UpgradeScenario.getTypeName()}
  ]
}
