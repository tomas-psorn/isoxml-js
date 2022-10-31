import {ISOXMLManager} from '../ISOXMLManager'
import {registerEntityClass} from '../classRegistry'

import {Entity, ISOXMLReference, ValueInformation, XMLElement} from '../types'

import {
    GridGridTypeEnum,
    ProcessDataVariable,
    Task,
    TaskAttributes,
    TreatmentZone,
    ValuePresentation
} from '../baseEntities'
import {ExtendedGrid} from './Grid'
import {FeatureCollection} from '@turf/helpers'
import {TAGS} from '../baseEntities/constants'
import {constructValueInformation, DDIToString} from '../utils'

export class ExtendedTask extends Task {
    public tag = TAGS.Task

    constructor(attributes: TaskAttributes, isoxmlManager: ISOXMLManager) {
        super(attributes, isoxmlManager)
    }

    static fromXML(xml: XMLElement, isoxmlManager: ISOXMLManager, internalId: string): Promise<Entity> {
        return Task.fromXML(xml, isoxmlManager, internalId, ExtendedTask)
    }

    addGridFromGeoJSON(
        geoJSON: FeatureCollection,
        DDI: number,
        deviceElemRef?: ISOXMLReference,
        vpnRef?: ISOXMLReference,
        gridType?: GridGridTypeEnum
    ): void {
        if ( gridType === GridGridTypeEnum.GridType2) {
        const processDataVariable = this.isoxmlManager.createEntityFromAttributes<ProcessDataVariable>(
            TAGS.ProcessDataVariable, {
                ProcessDataDDI: DDIToString(DDI),
                ProcessDataValue: 0,
                ...deviceElemRef && { DeviceElementIdRef: deviceElemRef },
                ...vpnRef && { ValuePresentationIdRef: vpnRef }
            })
        this.attributes.TreatmentZone = [
            this.isoxmlManager.createEntityFromAttributes(TAGS.TreatmentZone, {
                TreatmentZoneCode: 0,
                ProcessDataVariable: [processDataVariable]
            }) as TreatmentZone,
            this.isoxmlManager.createEntityFromAttributes(TAGS.TreatmentZone, {
                TreatmentZoneCode: 1,
                ProcessDataVariable: [processDataVariable]
            }) as TreatmentZone
        ]} else {
            let processDataVariable = this.isoxmlManager.createEntityFromAttributes<ProcessDataVariable>(
                TAGS.ProcessDataVariable, {
                    ProcessDataDDI: DDIToString(DDI),
                    ProcessDataValue: 0,
                    ...deviceElemRef && { DeviceElementIdRef: deviceElemRef },
                    ...vpnRef && { ValuePresentationIdRef: vpnRef }
                })
            this.attributes.TreatmentZone = [
                this.isoxmlManager.createEntityFromAttributes(TAGS.TreatmentZone, {
                    TreatmentZoneCode: 0,
                    ProcessDataVariable: [processDataVariable]
                }) as TreatmentZone
            ]

            const zones = geoJSON.features.reduce((acc, feature) => {
                if (acc.find(item => item.code === feature.properties.zone)) return acc

                acc.push({
                    code: feature.properties.zone,
                    dose: feature.properties.DOSE
                })

                return acc
            }, [])

            zones.forEach((zone) => {
                processDataVariable = this.isoxmlManager.createEntityFromAttributes<ProcessDataVariable>(
                    TAGS.ProcessDataVariable, {
                        ProcessDataDDI: DDIToString(DDI),
                        ProcessDataValue: zone.dose || 0,
                        ...deviceElemRef && { DeviceElementIdRef: deviceElemRef },
                        ...vpnRef && { ValuePresentationIdRef: vpnRef }
                    })
                this.attributes.TreatmentZone.push(this.isoxmlManager.createEntityFromAttributes(TAGS.TreatmentZone, {
                    TreatmentZoneCode:  zone.code,
                    ProcessDataVariable: [processDataVariable]
                }) as TreatmentZone)
            })
        }

        this.attributes.OutOfFieldTreatmentZoneCode = 0
        this.attributes.Grid = [
            ExtendedGrid.fromGeoJSON(geoJSON, this.isoxmlManager, 1, gridType)
        ]
    }

    getGridAsGeoJSON(): FeatureCollection {
        if (!this.attributes.Grid) {
            return null
        }
        return (this.attributes.Grid[0] as ExtendedGrid).toGeoJSON()
    }

    getGridValuesDescription(): ValueInformation[] {
        const grid = this.attributes.Grid?.[0]
        if (!grid) {
            return []
        }

        const treatmentZoneCode = grid.attributes.TreatmentZoneCode
        const treatmentZone = (this.attributes.TreatmentZone || [])
            .find(tz => tz.attributes.TreatmentZoneCode === treatmentZoneCode)

        if (!treatmentZone) {
            return []
        }

        return (treatmentZone.attributes.ProcessDataVariable || []).map(pdv => {
            const vpn = pdv.attributes.ValuePresentationIdRef?.entity as ValuePresentation
            return constructValueInformation(pdv.attributes.ProcessDataDDI, vpn)
        })
    }
}

registerEntityClass('main', TAGS.Task, ExtendedTask)
