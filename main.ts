import {Construct} from "constructs";
import {App, TerraformStack, TerraformVariable} from "cdktf";
import {AwsProvider, AwsProviderConfig, AwsProviderDefaultTags} from "@cdktf/provider-aws/lib/provider";
import {SecurityGroup} from "@cdktf/provider-aws/lib/security-group";
import {Vpc} from "@cdktf/provider-aws/lib/vpc";
import {EksCluster} from "@cdktf/provider-aws/lib/eks-cluster";
import {IamRole} from "@cdktf/provider-aws/lib/iam-role";
import {Subnet} from "@cdktf/provider-aws/lib/subnet";
import {IamRolePolicyAttachment} from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import {EcrRepository} from "@cdktf/provider-aws/lib/ecr-repository";
import {InternetGateway} from "@cdktf/provider-aws/lib/internet-gateway";
import {NatGateway} from "@cdktf/provider-aws/lib/nat-gateway";
import {RouteTable} from "@cdktf/provider-aws/lib/route-table";
import {Route} from "@cdktf/provider-aws/lib/route";
import {Eip} from "@cdktf/provider-aws/lib/eip";
import {EksNodeGroup} from "@cdktf/provider-aws/lib/eks-node-group";

class LanchoneteStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        const AWS_ACCESS_KEY_ID = new TerraformVariable(this, "AWS_ACCESS_KEY_ID", {type: "string", sensitive: true});
        const AWS_SECRET_ACCESS_KEY = new TerraformVariable(this, "AWS_SECRET_ACCESS_KEY", {
            type: "string",
            sensitive: true
        });

        const tags: AwsProviderDefaultTags[] = [
            {
                tags: {
                    'environment': 'dev',
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

        const vpc = new Vpc(this, 'eksVpc', {
            cidrBlock: '10.0.0.0/16',

        });

        console.log(cfg);

        const subnet = new Subnet(this, 'eksSubnet', {
            vpcId: vpc.id,
            cidrBlock: '10.0.1.0/24',
            availabilityZone: 'us-east-1a',
            mapPublicIpOnLaunch: true
        });

        const subnet2 = new Subnet(this, 'eksSubnet2', {
            vpcId: vpc.id,
            cidrBlock: '10.0.2.0/24',
            availabilityZone: 'us-east-1b',
            mapPublicIpOnLaunch: true
        });

        const securityGroup = new SecurityGroup(this, 'eksSecurityGroup', {
            vpcId: vpc.id,
            ingress: [{
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0']
            }],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: '-1',
                cidrBlocks: ['0.0.0.0/0']
            }]
        });

        const eksRole = new IamRole(this, 'eksRole', {
            assumeRolePolicy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: {
                        Service: 'eks.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'
                }]
            })
        });

        const nodeGroupRole = new IamRole(this, 'eksNodeGroupRole', {
            assumeRolePolicy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: {
                        Service: 'ec2.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'
                }]
            })
        });
        new IamRolePolicyAttachment(this, 'eksNodeGroupRolePolicyAttachment1', {
            role: nodeGroupRole.name,
            policyArn: 'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy'
        });


        new IamRolePolicyAttachment(this, 'eksRolePolicyAttachment2', {
            role: eksRole.name,
            policyArn: 'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy'
        });

        new IamRolePolicyAttachment(this, 'eksRolePolicyAttachment3', {
            role: eksRole.name,
            policyArn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly'
        });


        new EcrRepository(this, 'eksEcrRepository', {
            name: "lanchonete-api",
            forceDelete: true
        });

        const eks = new EksCluster(this, 'eksCluster', {
            name: 'my-eks-cluster',
            roleArn: eksRole.arn,
            vpcConfig: {
                subnetIds: [subnet.id, subnet2.id],
                securityGroupIds: [securityGroup.id],
                endpointPublicAccess: true,
                endpointPrivateAccess: true
            }
        });
        new EksNodeGroup(this, 'eksNodeGroup', {
            clusterName: eks.name,
            nodeGroupName: 'eks-node-group',
            nodeRoleArn: nodeGroupRole.arn,
            subnetIds: [subnet.id, subnet2.id],
            scalingConfig: {
                desiredSize: 2,
                maxSize: 4,
                minSize: 1
            },
            instanceTypes: ['t3.medium'],
            diskSize: 20
        });
        new InternetGateway(this, 'InternetGateway', {
            vpcId: vpc.id,
        });

        const eip = new Eip(this, 'Eip', {});

        const natGateway = new NatGateway(this, 'NatGateway', {
            allocationId: eip.id,
            subnetId: subnet.id,
        });

        const routeTable = new RouteTable(this, 'RouteTable', {
            vpcId: vpc.id,
        });

        new Route(this, 'Route', {
            routeTableId: routeTable.id,
            destinationCidrBlock: '0.0.0.0/0',
            natGatewayId: natGateway.id,
        });
    }
}

const app = new App();
new LanchoneteStack(app, "lanchonete-infra");
app.synth();