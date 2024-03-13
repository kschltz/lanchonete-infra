import {Construct} from "constructs";
import {App, TerraformStack} from "cdktf";
import {AwsProvider, AwsProviderDefaultTags} from "@cdktf/provider-aws/lib/provider";
import {SecurityGroup} from "@cdktf/provider-aws/lib/security-group";
import {Vpc} from "@cdktf/provider-aws/lib/vpc";
import {EksCluster} from "@cdktf/provider-aws/lib/eks-cluster";
import {IamRole} from "@cdktf/provider-aws/lib/iam-role";
import {Subnet} from "@cdktf/provider-aws/lib/subnet";
import {IamRolePolicyAttachment} from "@cdktf/provider-aws/lib/iam-role-policy-attachment";

class LanchoneteStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const tags: AwsProviderDefaultTags[] = [
            {
                tags: {
                    'environment': 'dev',
                },
            },
        ];

        new AwsProvider(this, 'aws-provider', {
            defaultTags: tags,
            accessKey: process.env.AWS_ACCESS_KEY_ID,
            secretKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_DEFAULT_REGION,
            profile: process.env.AWS_PROFILE,
        });

        const vpc = new Vpc(this, 'eksVpc', {
            cidrBlock: '10.0.0.0/16'
        });

        const subnet = new Subnet(this, 'eksSubnet', {
            vpcId: vpc.id,
            cidrBlock: '10.0.1.0/24',
            availabilityZone: 'us-east-1a'
        });

        const subnet2 = new Subnet(this, 'eksSubnet2', {
            vpcId: vpc.id,
            cidrBlock: '10.0.2.0/24',
            availabilityZone: 'us-east-1b'
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

        new IamRolePolicyAttachment(this, 'eksRolePolicyAttachment', {
            role: eksRole.name,
            policyArn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy'
        });

        new EksCluster(this, 'eksCluster', {
            name: 'my-eks-cluster',
            roleArn: eksRole.arn,
            vpcConfig: {
                subnetIds: [subnet.id, subnet2.id],
                securityGroupIds: [securityGroup.id],
                endpointPublicAccess: true,
                endpointPrivateAccess: true
            }
        });


    }
}


const app = new App();
new LanchoneteStack(app, "lanchonete-infra");
app.synth();
