import {Construct} from "constructs";
import {App, DataTerraformRemoteStateLocal, TerraformStack, TerraformVariable} from "cdktf";
import {AwsProvider, AwsProviderConfig, AwsProviderDefaultTags} from "@cdktf/provider-aws/lib/provider";
import {EcrRepository} from "@cdktf/provider-aws/lib/ecr-repository";
import * as Eks from "./.gen/modules/terraform-aws-modules/aws/eks";
import {VPCStack} from "./modules/vpcStack";

class LanchoneteStack extends TerraformStack {
    constructor(scope: Construct, id: string, vpcStack: VPCStack) {
        super(scope, id);
        const AWS_ACCESS_KEY_ID = new TerraformVariable(this, "AWS_ACCESS_KEY_ID", {type: "string", sensitive: true});
        const AWS_SECRET_ACCESS_KEY = new TerraformVariable(this, "AWS_SECRET_ACCESS_KEY", {
            type: "string",
            sensitive: true
        });
        console.log(vpcStack.vpcId);
        const tags: AwsProviderDefaultTags[] = [
            {
                tags: {
                    'environment': 'dev',
                    'project': 'lanchonete'
                },
            },
        ];
        const cfg: AwsProviderConfig = {
            defaultTags: tags,
            accessKey: AWS_ACCESS_KEY_ID.stringValue,
            secretKey: AWS_SECRET_ACCESS_KEY.stringValue,
            region: "us-east-1"
        }
        new AwsProvider(this, 'aws-provider', cfg);


        new EcrRepository(this, 'ecr-lanchonete-api', {
            name: "lanchonete-api",
            forceDelete: true,

        });

        const localState = new DataTerraformRemoteStateLocal(this, "vpc-state", {
            path: "terraform.vpc-infra.tfstate",
        });

        console.log(
            localState.toString(),
            "vpc_id", localState.getString("vpc_id"),
            "vpc_private_subnets", localState.getString("vpc_private_subnets"),
            "vpc_public_subnets", localState.getString("vpc_public_subnets"),
            "vpc_intra_subnets", localState.getString("vpc_intra_subnets"));

        new Eks.Eks(this, "eks", {
            clusterAddons: [
                {
                    coredns: [
                        {
                            most_recent: true,
                        },
                    ],
                    "kube-proxy": [
                        {
                            most_recent: true,
                        },
                    ],
                    "vpc-cni": [
                        {
                            most_recent: true,
                        },
                    ],
                },
            ],
            clusterEndpointPublicAccess: true,
            clusterName: "mba-fiap-cluster",
            controlPlaneSubnetIds: localState.getList("vpc_public_subnets"),
            eksManagedNodeGroupDefaults: [
                {
                    ami_type: "AL2_x86_64",
                    attach_cluster_primary_security_group: true,
                    instance_types: ["m5.large"],
                },
            ],
            eksManagedNodeGroups: [
                {
                    "ascode-cluster-wg": [
                        {
                            capacity_type: "SPOT",
                            desired_size: 1,
                            instance_types: ["t3.large"],
                            max_size: 2,
                            min_size: 1,
                            tags: {
                                ExtraTag: "helloworld",
                            },
                        },
                    ],
                },
            ],
            subnetIds: localState.getList("vpc_private_subnets"),
            tags: tags[0].tags,
            vpcId: localState.getString("vpc_id"),
        });
    }


}

const app = new App();
const vpcStack = new VPCStack(app, "vpc-infra");
const lanchoneteStack = new LanchoneteStack(app, "lanchonete-infra", vpcStack);
lanchoneteStack.addDependency(vpcStack);
app.synth();
